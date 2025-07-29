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
  console.log('=== WEBHOOK STARTED ===');
  
  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const data = req.body;
    console.log('✅ Processing request for user:', data.user_id || data.chat_id);
    console.log('📋 Received data keys:', Object.keys(data));
    
    // Проверяем наличие API ключа
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key found');
    
    // Генерируем промпт
    console.log('🔄 Building prompt...');
    const prompt = buildPrompt(data);
    console.log('✅ Prompt built, length:', prompt.length);
    console.log('📝 Prompt preview:', prompt.substring(0, 200) + '...');
    
    // Получаем ответ от ИИ
    console.log('🔄 Getting AI response...');
    const aiResponse = await getAIResponse(prompt);
    console.log('✅ AI response received, length:', aiResponse.length);
    console.log('📝 Response preview:', aiResponse.substring(0, 200) + '...');
    
    // Параллельно отправляем в Telegram и возвращаем ответ
    console.log('🔄 Sending to Telegram...');
    const telegramPromise = sendToTelegram(aiResponse, data);
    
    // Не ждем завершения отправки в Telegram
    telegramPromise.catch(error => 
      console.error('❌ Telegram send failed:', error.message)
    );
    
    console.log('✅ Returning response to BotHelp');
    return res.status(200).json({ 
      success: true, 
      ai_analysis: aiResponse
    });
    
  } catch (error) {
    console.error('❌ Handler error:', error.message);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Processing failed',
      details: error.message
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
  console.log('🔄 Starting OpenAI process...');
  
  try {
    console.log('🔄 Creating thread...');
    const threadId = await createThread();
    console.log('✅ Thread created:', threadId);
    
    console.log('🔄 Adding message to thread...');
    await addMessage(threadId, prompt);
    console.log('✅ Message added');
    
    console.log('🔄 Starting run...');
    const runId = await startRun(threadId);
    console.log('✅ Run started:', runId);
    
    console.log('🔄 Waiting for completion...');
    await waitForCompletion(threadId, runId);
    console.log('✅ Run completed');
    
    console.log('🔄 Getting response...');
    const response = await getResponse(threadId);
    console.log('✅ Response retrieved');
    
    return response;
  } catch (error) {
    console.error('❌ getAIResponse error:', error.message);
    throw error;
  }
}

// Создание нового треда
async function createThread() {
  console.log('🔄 Calling OpenAI threads API...');
  
  const response = await fetchWithRetry('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: CONFIG.OPENAI_HEADERS,
    body: JSON.stringify({})
  });
  
  const thread = await response.json();
  console.log('✅ Thread API response:', { id: thread.id, object: thread.object });
  
  if (!thread.id) {
    throw new Error('Thread creation failed - no ID returned');
  }
  
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
      console.log(`🔄 Fetch attempt ${attempt}/${maxRetries}:`, url);
      
      const response = await fetch(url, options);
      console.log(`📡 HTTP ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log('✅ Fetch successful');
        return response;
      }
      
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, errorText);
      
      // Если это последняя попытка или критическая ошибка
      if (attempt === maxRetries || response.status === 401 || response.status === 403) {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // Для повторяемых ошибок ждем перед следующей попыткой
      if (response.status >= 500 || response.status === 429) {
        const delay = 1000 * attempt;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }
      
      // Для других ошибок не повторяем
      throw new Error(`HTTP ${response.status}: ${errorText}`);
      
    } catch (error) {
      console.error(`❌ Fetch error on attempt ${attempt}:`, error.message);
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Повторяем только сетевые ошибки
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const delay = 1000 * attempt;
        console.log(`⏳ Network error, waiting ${delay}ms...`);
        await sleep(delay);
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
