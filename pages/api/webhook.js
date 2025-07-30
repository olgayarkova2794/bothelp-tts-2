import { PROMPT_TEMPLATE, FOLLOW_UP_PROMPT_TEMPLATE } from './config.js';

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`=== WEBHOOK STARTED [${requestId}] ===`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const data = req.body;
    console.log('Received data from BotHelp');
    console.log('User name:', data.name_test_voice);
    console.log('Has test data:', !!data['1_test_voice']);
    console.log('Has follow-up question:', !!data.user_question);
    console.log('Has previous analysis:', !!data.ai_analysis_result);
    console.log('AI Status:', data.ai_status);
    
    // Определяем тип запроса по статусу
    const isFollowUpQuestion = data.ai_status === 'question_asked';
    
    let prompt;
    let response;
    
    if (isFollowUpQuestion) {
      // Это дополнительный вопрос к уже проведенному анализу
      console.log('Processing follow-up question - status: question_asked');
      
      // Проверяем, что есть вопрос и предыдущий анализ
      if (!data.user_question || !data.ai_analysis_result) {
        console.log('❌ Missing data for follow-up question');
        return res.status(400).json({ 
          error: 'Missing data for follow-up', 
          message: 'User question and previous analysis are required for follow-up' 
        });
      }
      
      prompt = createFollowUpPrompt(data);
      response = await callOpenAIAssistant(prompt);
    } else {
      // Это первичный анализ ответов
      console.log('Processing initial analysis - status:', data.ai_status || 'undefined');
      
      // ПРОВЕРЯЕМ, что у нас есть минимальные данные для первичного анализа
      if (!data.name_test_voice || data.name_test_voice === 'Клиент') {
        console.log('❌ Insufficient data - name is missing or default');
        return res.status(400).json({ 
          error: 'Insufficient data', 
          message: 'Name is required' 
        });
      }
      
      // Дополнительная проверка на наличие хотя бы одного ответа
      const hasAnswers = data['1_test_voice'] || data['2_test_voice'] || data['3_test_voice'];
      if (!hasAnswers) {
        console.log('❌ No test answers provided');
        return res.status(400).json({ 
          error: 'No answers', 
          message: 'At least one answer is required' 
        });
      }
      
      prompt = createInitialPrompt(data);
      response = await callOpenAIAssistant(prompt);
    }
    
    console.log('AI Response received:');
    console.log('Length:', response.length);
    console.log('First 300 chars:', response.substring(0, 300));
    console.log('Last 300 chars:', response.substring(response.length - 300));
    
    // Отправляем ответ в Telegram
    await sendToTelegram(response, data);
    
    // Возвращаем результат в BotHelp с разными именами переменных
    let responseData;
    
    if (isFollowUpQuestion) {
      // Для дополнительного вопроса сохраняем в отдельную переменную
      responseData = {
        success: true, 
        message: 'Ответ на дополнительный вопрос отправлен в бот',
        ai_followup_result: response  // Результат дополнительного анализа
      };
      console.log('Returning to BotHelp - ai_followup_result length:', response.length);
    } else {
      // Для первичного анализа сохраняем в основную переменную
      responseData = {
        success: true, 
        message: 'Первичный анализ отправлен в бот',
        ai_analysis_result: response  // Результат первичного анализа
      };
      console.log('Returning to BotHelp - ai_analysis_result length:', response.length);
    }
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function createInitialPrompt(data) {
  // Заменяем плейсхолдеры в промпте на реальные данные
  return PROMPT_TEMPLATE
    .replace(/\[name_test_voice\]/g, data.name_test_voice || 'Клиент')
    .replace(/\[1_test_voice\]/g, data['1_test_voice'] || 'не указано')
    .replace(/\[2_test_voice\]/g, data['2_test_voice'] || 'не указано')
    .replace(/\[3_test_voice\]/g, data['3_test_voice'] || 'не указано')
    .replace(/\[4_test_voice\]/g, data['4_test_voice'] || 'не указано')
    .replace(/\[5_test_voice\]/g, data['5_test_voice'] || 'не указано')
    .replace(/\[6_test_voice\]/g, data['6_test_voice'] || 'не указано')
    .replace(/\[7_test_voice\]/g, data['7_test_voice'] || 'не указано')
    .replace(/\[8_test_voice\]/g, data['8_test_voice'] || 'не указано')
    .replace(/\[9_test_voice\]/g, data['9_test_voice'] || 'не указано')
    .replace(/\[10_test_voice\]/g, data['10_test_voice'] || 'не указано');
}

function createFollowUpPrompt(data) {
  // Создаем промпт для дополнительного вопроса
  return FOLLOW_UP_PROMPT_TEMPLATE
    .replace(/\[name_test_voice\]/g, data.name_test_voice || 'Клиент')
    .replace(/\[previous_analysis\]/g, data.ai_analysis_result || '')  // Берем первичный анализ
    .replace(/\[user_question\]/g, data.user_question || '')
    .replace(/\[1_test_voice\]/g, data['1_test_voice'] || 'не указано')
    .replace(/\[2_test_voice\]/g, data['2_test_voice'] || 'не указано')
    .replace(/\[3_test_voice\]/g, data['3_test_voice'] || 'не указано')
    .replace(/\[4_test_voice\]/g, data['4_test_voice'] || 'не указано')
    .replace(/\[5_test_voice\]/g, data['5_test_voice'] || 'не указано')
    .replace(/\[6_test_voice\]/g, data['6_test_voice'] || 'не указано')
    .replace(/\[7_test_voice\]/g, data['7_test_voice'] || 'не указано')
    .replace(/\[8_test_voice\]/g, data['8_test_voice'] || 'не указано')
    .replace(/\[9_test_voice\]/g, data['9_test_voice'] || 'не указано')
    .replace(/\[10_test_voice\]/g, data['10_test_voice'] || 'не указано');
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
