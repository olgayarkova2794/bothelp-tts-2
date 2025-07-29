import { PROMPT_TEMPLATE } from './config.js';

// Константы конфигурации
const CONFIG = {
  ASSISTANT_ID: "asst_FTQwIDbblkhegDXBZxd2nU9w",
  MAX_WAIT_TIME: 60000, // 60 секунд
  POLL_INTERVAL: 1000,   // 1 секунда
  OPENAI_HEADERS: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'OpenAI-Beta': 'assistants=v2'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const data = req.body;
    console.log('Processing request for user:', data.user_id || data.chat_id);
    
    // Генерируем промпт
    const prompt = buildPrompt(data);
    
    // Получаем ответ от ИИ
    const aiResponse = await getAIResponse(prompt);
    
    // Параллельно отправляем в Telegram и возвращаем ответ
    const telegramPromise = sendToTelegram(aiResponse, data);
    
    // Не ждем завершения отправки в Telegram
    telegramPromise.catch(error => 
      console.error('Telegram send failed:', error.message)
    );
    
    return res.status(200).json({ 
      success: true, 
      ai_analysis: aiResponse
    });
    
  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ 
      error: 'Processing failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Функция построения промпта с кэшированием шаблона
function buildPrompt(data) {
  const replacements = [
    ['[name_test_voice]', data.name_test_voice || 'Клиент'],
    ...Array.from({length: 10}, (_, i) => [
      `[${i + 1}_test_voice]`, 
      data[`${i + 1}_test_voice`] || 'не указано'
    ])
  ];
  
  return replacements.reduce(
    (prompt, [placeholder, value]) => prompt.replace(placeholder, value),
    PROMPT_TEMPLATE
  );
}

// Основная функция для работы с OpenAI
async function getAIResponse(prompt) {
  const threadId = await createThread();
  await addMessage(threadId, prompt);
  const runId = await startRun(threadId);
  await waitForCompletion(threadId, runId);
  return await getResponse(threadId);
}

// Создание нового треда
async function createThread() {
  const response = await fetchWithRetry('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: CONFIG.OPENAI_HEADERS,
    body: JSON.stringify({})
  });
  
  const thread = await response.json();
  return thread.id;
}

// Добавление сообщения в тред
async function addMessage(threadId, content) {
  await fetchWithRetry(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: 'POST',
    headers: CONFIG.OPENAI_HEADERS,
    body: JSON.stringify({
      role: "user",
      content: content
    })
  });
}

// Запуск ассистента
async function startRun(threadId) {
  const response = await fetchWithRetry(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: 'POST',
    headers: CONFIG.OPENAI_HEADERS,
    body: JSON.stringify({
      assistant_id: CONFIG.ASSISTANT_ID
    })
  });
  
  const run = await response.json();
  return run.id;
}

// Ожидание завершения с оптимизированным polling
async function waitForCompletion(threadId, runId) {
  const startTime = Date.now();
  let pollInterval = CONFIG.POLL_INTERVAL;
  
  while (Date.now() - startTime < CONFIG.MAX_WAIT_TIME) {
    const response = await fetchWithRetry(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      { headers: CONFIG.OPENAI_HEADERS }
    );
    
    const runStatus = await response.json();
    
    if (runStatus.status === 'completed') {
      return;
    }
    
    if (runStatus.status === 'failed') {
      throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
    }
    
    if (!['queued', 'in_progress'].includes(runStatus.status)) {
      throw new Error(`Unexpected status: ${runStatus.status}`);
    }
    
    // Увеличиваем интервал опроса для длительных запросов
    await sleep(pollInterval);
    pollInterval = Math.min(pollInterval * 1.1, 3000); // максимум 3 сек
  }
  
  throw new Error('Request timeout');
}

// Получение ответа от ассистента
async function getResponse(threadId) {
  const response = await fetchWithRetry(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    { headers: CONFIG.OPENAI_HEADERS }
  );
  
  const messages = await response.json();
  
  const assistantMessage = messages.data?.[0];
  if (!assistantMessage?.content?.[0]?.text?.value) {
    throw new Error('Empty response from assistant');
  }
  
  return assistantMessage.content[0].text.value;
}

// Fetch с повторными попытками и лучшей обработкой ошибок
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // Если это последняя попытка или критическая ошибка
      if (attempt === maxRetries || response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // Для повторяемых ошибок ждем перед следующей попыткой
      if (response.status >= 500 || response.status === 429) {
        await sleep(1000 * attempt); // экспоненциальная задержка
        continue;
      }
      
      // Для других ошибок не повторяем
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
      
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Повторяем только сетевые ошибки
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        await sleep(1000 * attempt);
        continue;
      }
      
      throw error;
    }
  }
}

// Отправка в Telegram (неблокирующая)
async function sendToTelegram(text, data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = data.user_id || data.chat_id;
  
  if (!botToken || !chatId) {
    console.log('Telegram credentials missing, skipping send');
    return;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.length > 4096 ? text.substring(0, 4093) + '...' : text, // Telegram лимит
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }
    
    console.log('Telegram message sent successfully');
    
  } catch (error) {
    console.error('Telegram send error:', error.message);
    throw error; // Пробрасываем для обработки в основном коде
  }
}

// Утилита для задержки
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
