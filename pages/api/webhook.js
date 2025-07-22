export default async function handler(req, res) {
  console.log('Received request:', req.body);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const data = req.body;
    const userText = data.voiceover_test || 'Текст не найден';
    
    console.log('User text:', userText);
    console.log('Full request data:', data);
    
    // Генерируем саммари медитации через OpenAI
    const meditationSummary = await generateMeditationSummary(userText);
    console.log('Meditation summary generated:', meditationSummary);
    
    // Отправляем текстовое сообщение в Telegram
    await sendTextToTelegram(meditationSummary, data);
    
    res.status(200).json({
      success: true,
      message: `Саммари медитации отправлено: "${meditationSummary}"`
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function generateMeditationSummary(userText) {
  console.log('Generating meditation summary for:', userText);
  
  const ASSISTANT_ID = "asst_FTQwIDbblkhegDXBZxd2nU9w";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  try {
    // 1. Создаем thread (беседу)
    const threadResponse = await fetch('https://api.openai.com/v1/assistants/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({})
    });
    
    const thread = await threadResponse.json();
    const threadId = thread.id;
    
    // 2. Добавляем сообщение пользователя в thread
    await fetch(`https://api.openai.com/v1/assistants/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: "user",
        content: `Прокомментируй то, что написал пользователь: "${userText}"`
      })
    });
    
    // 3. Запускаем ассистента
    const runResponse = await fetch(`https://api.openai.com/v1/assistants/threads/${threadId}/runs`, {
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
    
    const run = await runResponse.json();
    const runId = run.id;
    
    // 4. Ждем завершения выполнения
    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем 1 секунду
      
      const statusResponse = await fetch(`https://api.openai.com/v1/assistants/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      runStatus = await statusResponse.json();
      console.log('Run status:', runStatus.status);
      
    } while (runStatus.status === 'queued' || runStatus.status === 'in_progress');
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }
    
    // 5. Получаем ответ ассистента
    const messagesResponse = await fetch(`https://api.openai.com/v1/assistants/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const messages = await messagesResponse.json();
    const lastMessage = messages.data[0]; // Последнее сообщение (ответ ассистента)
    
    // Возвращаем просто текст, как ожидается в основной функции
    return lastMessage.content[0].text.value;
    
  } catch (error) {
    console.error('Error with assistant:', error);
    throw error;
  }
}

async function sendTextToTelegram(text, requestData) {
  console.log('Sending text to Telegram...');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  // Пробуем разные варианты получения chat_id из BotHelp данных
  const chatId = requestData.chat_id || 
                 requestData.chatId || 
                 requestData.user_id || 
                 requestData.userId ||
                 requestData.chat?.id ||
                 requestData.from?.id;
  
  console.log('Chat ID:', chatId);
  console.log('Bot token exists:', !!botToken);
  
  if (!chatId) {
    throw new Error('Chat ID not found in request data');
  }
  
  if (!botToken) {
    throw new Error('Telegram bot token not configured');
  }
  
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML' // Поддержка HTML форматирования, если нужно
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Text message sent successfully:', result.ok);
  
  return result;
}
