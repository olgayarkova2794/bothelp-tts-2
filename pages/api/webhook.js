export default async function handler(req, res) {
  console.log('Received request:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    const userText = data.voiceover_test || 'Текст не найден';
    
    // Создаем полный текст для озвучки
    const fullText = `Вы написали: ${userText}`;
    
    console.log('User text:', userText);
    console.log('Full text for TTS:', fullText);
    console.log('Full request data:', data);
    
    // Генерируем аудио для полного текста
    const audioBuffer = await textToSpeech(fullText);
    console.log('Audio generated, size:', audioBuffer.byteLength);
    
    // Отправляем голосовое сообщение в Telegram
    await sendVoiceToTelegram(audioBuffer, data);
    
    res.status(200).json({
      success: true,
      message: `Голосовое сообщение отправлено: "Вы написали: ${userText}"`
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function textToSpeech(text) {
  console.log('Generating TTS for:', text);
  
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }
  
  return await response.arrayBuffer();
}

async function sendVoiceToTelegram(audioBuffer, requestData) {
  console.log('Sending voice to Telegram...');
  
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
  
  // Создаем FormData для отправки файла
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'voice.mp3');
  
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Voice message sent successfully:', result.ok);
  
  return result;
}
