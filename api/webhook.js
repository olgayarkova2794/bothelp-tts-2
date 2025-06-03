export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, chat_id } = req.body;
    
    // Ваша логика генерации текста
    const responseText = `Вы написали: ${message.text}`;
    
    // Здесь будет вызов TTS API
    console.log('Generating audio for:', responseText);
    
    // Пока просто отправляем текст обратно
    res.status(200).json({
      success: true,
      text: responseText
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
