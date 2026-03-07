const Groq = require('groq-sdk');
const { systemPrompt } = require('../prompts/systemPrompt');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function getAIReply({ message, intent, leadScore, leadStatus, history = [] }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    {
      role: 'user',
      content:
        'Intent: ' + intent + '\n' +
        'Lead Score: ' + leadScore + '\n' +
        'Lead Status: ' + leadStatus + '\n' +
        'Visitor Message: ' + message
    }
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.5
  });

  return completion.choices?.[0]?.message?.content || 'Sorry, I had trouble responding.';
}

module.exports = { getAIReply };
