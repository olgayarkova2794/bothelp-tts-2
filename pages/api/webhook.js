export default async function handler(req, res) {
  console.log('Received request:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    const userText = data.voiceover_test || 'Текст не найден';
    
    console.log('User text:', userText);
    
    // Генерируем аудио
    const audioBuffer = await textToSpeech(userText);
    
    // Отправляем аудио напрямую в Telegram
    await sendVoiceToTelegram(audioBuffer, data);
    
    res.status(200).json({
      success: true,
      message: `Отправлено голосовое сообщение`
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function sendVoiceToTelegram(audioBuffer, requestData) {
  // Нужен Telegram Bot Token
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = requestData.chat?.id || requestData.user_id;
  
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'voice.mp3');
  
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`);
  }
}
