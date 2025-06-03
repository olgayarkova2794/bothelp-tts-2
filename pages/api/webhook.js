export default async function handler(req, res) {
  console.log('Received request:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    // Используем правильное название переменной из BotHelp
    const userText = data.voiceover_test || 
                     data.message?.text || 
                     'Текст не найден';
    
    console.log('User text from voiceover_test:', userText);
    
    const responseText = `Вы написали: ${userText}`;
    
    res.status(200).json({
      success: true,
      text: responseText,
      received_data: data // для отладки
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
