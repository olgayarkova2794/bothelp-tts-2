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
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o", // или "gpt-3.5-turbo" для более экономичного варианта
      messages: [
        {
          role: "system",
          content: `Ты должен прокомментировать то, что написал пользователь.`
        },
        {
          role: "user",
          content: `Опирайся на то, что написал пользователь: "${userText}"`
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  return result.choices[0].message.content.trim();
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
