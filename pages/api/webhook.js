import { PROMPT_TEMPLATE } from './config.js';

export default async function handler(req, res) {
  console.log('=== WEBHOOK STARTED ===');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const data = req.body;
    console.log('Received data from BotHelp');
    
    // Заменяем плейсхолдеры в промпте на реальные данные
    let prompt = PROMPT_TEMPLATE
      .replace('[name_test_voice]', data.name_test_voice || 'Клиент')
      .replace('[1_test_voice]', data['1_test_voice'] || 'не указано')
      .replace('[2_test_voice]', data['2_test_voice'] || 'не указано')
      .replace('[3_test_voice]', data['3_test_voice'] || 'не указано')
      .replace('[4_test_voice]', data['4_test_voice'] || 'не указано')
      .replace('[5_test_voice]', data['5_test_voice'] || 'не указано')
      .replace('[6_test_voice]', data['6_test_voice'] || 'не указано')
      .replace('[7_test_voice]', data['7_test_voice'] || 'не указано')
      .replace('[8_test_voice]', data['8_test_voice'] || 'не указано')
      .replace('[9_test_voice]', data['9_test_voice'] || 'не указано')
      .replace('[10_test_voice]', data['10_test_voice'] || 'не указано');
    
    console.log('Sending prompt to OpenAI assistant');
    
    // Отправляем в OpenAI
    const response = await callOpenAIAssistant(prompt);
    
    // Отправляем ответ в Telegram
    await sendToTelegram(response, data);
    
    res.status(200).json({ success: true, message: 'Ответ отправлен в бот' });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function callOpenAIAssistant(prompt) {
  const ASSISTANT_ID = "asst_FTQwIDbblkhegDXBZxd2nU9w";
  
  // 1. Создаем thread
  const threadResponse = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({})
  });
  
  const thread = await threadResponse.json();
  
  // 2. Добавляем сообщение
  await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: "user",
      content: prompt
    })
  });
  
  // 3. Запускаем ассистента
  const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: ASSISTANT_ID
    })
  });
  
  const run = await runResponse.json();
  
  // 4. Ждем завершения
  let runStatus;
  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    runStatus = await statusResponse.json();
    console.log('Run status:', runStatus.status);
    
  } while (runStatus.status === 'queued' || runStatus.status === 'in_progress');
  
  // 5. Получаем ответ
  const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  
  const messages = await messagesResponse.json();
  return messages.data[0].content[0].text.value;
}

async function sendToTelegram(text, data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = data.user_id || data.chat_id;
  
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
  
  console.log('Message sent to Telegram');
}
