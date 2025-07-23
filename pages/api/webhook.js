import { PROMPT_TEMPLATE, AVAILABLE_FIELDS } from './config.js';

export default async function handler(req, res) {
  console.log('=== WEBHOOK STARTED ===');
  console.log('Received request method:', req.method);
  console.log('Received request body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const data = req.body;
    
    console.log('=== EXTRACTED DATA ===');
    console.log('Full webhook data:', JSON.stringify(data, null, 2));
    console.log('Environment variables check:');
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
    
    // Генерируем саммари медитации через OpenAI
    console.log('=== CALLING OPENAI ASSISTANT ===');
    const meditationSummary = await generateMeditationSummary(data);
    console.log('Meditation summary generated:', meditationSummary);
    
    // Отправляем текстовое сообщение в Telegram
    console.log('=== SENDING TO TELEGRAM ===');
    const telegramResult = await sendTextToTelegram(meditationSummary, data);
    console.log('Telegram result:', telegramResult);
    
    res.status(200).json({
      success: true,
      message: `Саммари отправлено: "${meditationSummary}"`,
      telegramResult: telegramResult
    });
    
  } catch (error) {
    console.error('=== ERROR OCCURRED ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
}

async function generateMeditationSummary(webhookData) {
  console.log('=== GENERATING MEDITATION SUMMARY ===');
  console.log('Webhook data received');
  
  const ASSISTANT_ID = "asst_FTQwIDbblkhegDXBZxd2nU9w";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  
  // Шаблон промпта с плейсхолдерами
  const promptTemplate = `Ты говоришь с пользователем [name], его основной текст: [voiceover_test], 
его намерение: [намерение], 
ответ на магия вопрос 1: [Магия_вопрос1], 
ответ на магия вопрос 2: [Магия_вопрос2],
ответ на магия вопрос 3: [Магия_вопрос3],
его достижения: [достижения],
НГ желание: [НГ желание].

Проанализируй и дай персональный комментарий.`;

  // Заменяем плейсхолдеры на реальные данные
  let finalPrompt = promptTemplate;
  
  // Функция для безопасной замены (если поле пустое, заменяем на "не указано")
  const replaceField = (template, fieldName, value) => {
    const placeholder = `[${fieldName}]`;
    const replacement = value && value.toString().trim() ? value : 'не указано';
    return template.replace(new RegExp(`\\[${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\async function generateMeditationSummary(webhookData) {
  console.log('=== GENERATING MEDITATION SUMMARY ===');
  console.log('Webhook data received');
  
  const ASSISTANT_ID = "asst_FTQwIDbblkhegDXBZxd2nU9w";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  
  // Преобразуем данные webhook в текст для ассистента
  const webhookText = JSON.stringify(webhookData, null, 2);
  console.log('Sending webhook data to assistant');
  
  try {')}\\]`, 'g'), replacement);
  };
  
  // Автоматически заменяем все поля из конфигурации
  AVAILABLE_FIELDS.forEach(fieldName => {
    if (fieldName === 'name') {
      // Специальная логика для имени
      finalPrompt = replaceField(finalPrompt, 'name', webhookData['Имя'] || webhookData['имя'] || webhookData.first_name);
    } else {
      // Обычные поля
      finalPrompt = replaceField(finalPrompt, fieldName, webhookData[fieldName]);
    }
  });
  
  console.log('Final prompt after template replacement:', finalPrompt);
  
  try {
    console.log('Step 1: Creating thread...');
    // 1. Создаем thread (беседу)
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({})
    });
    
    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      throw new Error(`Failed to create thread: ${threadResponse.status} ${errorText}`);
    }
    
    const thread = await threadResponse.json();
    const threadId = thread.id;
    console.log('Thread created with ID:', threadId);
    
    console.log('Step 2: Adding message to thread...');
    // 2. Добавляем сообщение пользователя в thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: "user",
        content: finalPrompt
      })
    });
    
    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      throw new Error(`Failed to add message: ${messageResponse.status} ${errorText}`);
    }
    
    console.log('Message added to thread');
    
    console.log('Step 3: Running assistant...');
    // 3. Запускаем ассистента
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID
      })
    });
    
    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Failed to run assistant: ${runResponse.status} ${errorText}`);
    }
    
    const run = await runResponse.json();
    const runId = run.id;
    console.log('Assistant run started with ID:', runId);
    
    console.log('Step 4: Waiting for completion...');
    // 4. Ждем завершения выполнения
    let runStatus;
    let attempts = 0;
    const maxAttempts = 30; // Максимум 30 секунд ожидания
    
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Failed to check status: ${statusResponse.status} ${errorText}`);
      }
      
      runStatus = await statusResponse.json();
      console.log(`Run status (attempt ${attempts}):`, runStatus.status);
      
      if (attempts >= maxAttempts) {
        throw new Error('Assistant run timeout after 30 seconds');
      }
      
    } while (runStatus.status === 'queued' || runStatus.status === 'in_progress');
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }
    
    console.log('Step 5: Getting response...');
    // 5. Получаем ответ ассистента
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      throw new Error(`Failed to get messages: ${messagesResponse.status} ${errorText}`);
    }
    
    const messages = await messagesResponse.json();
    const lastMessage = messages.data[0];
    const responseText = lastMessage.content[0].text.value;
    
    console.log('Assistant response received:', responseText);
    return responseText;
    
  } catch (error) {
    console.error('Error in generateMeditationSummary:', error);
    throw error;
  }
}

async function sendTextToTelegram(text, requestData) {
  console.log('=== SENDING TEXT TO TELEGRAM ===');
  console.log('Text to send:', text);
  console.log('Request data keys:', Object.keys(requestData));
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
  }
  
  // Пробуем разные варианты получения chat_id из данных
  const chatId = requestData.chat_id || 
                 requestData.chatId || 
                 requestData.user_id || 
                 requestData.userId ||
                 requestData.chat?.id ||
                 requestData.from?.id ||
                 requestData.message?.chat?.id ||
                 requestData.message?.from?.id;
  
  console.log('Extracted chat ID:', chatId);
  console.log('Bot token exists:', !!botToken);
  console.log('Bot token length:', botToken ? botToken.length : 0);
  
  if (!chatId) {
    console.log('Available request data:', JSON.stringify(requestData, null, 2));
    throw new Error('Chat ID not found in request data');
  }
  
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  
  console.log('Telegram URL:', telegramUrl.replace(botToken, '[HIDDEN]'));
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    console.log('Telegram API response status:', response.status);
    console.log('Telegram API response:', responseText);
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${responseText}`);
    }
    
    const result = JSON.parse(responseText);
    console.log('Text message sent successfully. Result OK:', result.ok);
    
    return result;
    
  } catch (error) {
    console.error('Error sending to Telegram:', error);
    throw error;
  }
}
