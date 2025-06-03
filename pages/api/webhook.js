export default async function handler(req, res) {
  console.log('Received request:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    const userText = data.voiceover_test || 'Текст не найден';
    
    console.log('User text:', userText);
    
    // Генерируем аудио через ElevenLabs
    const audioBuffer = await textToSpeech(userText);
    console.log('Audio generated, size:', audioBuffer.byteLength);
    
    // Конвертируем в base64 для отправки
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    res.status(200).json({
      success: true,
      text: `Озвучка готова для: ${userText}`,
      audio: base64Audio,
      audio_format: 'mp3'
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
  
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}
