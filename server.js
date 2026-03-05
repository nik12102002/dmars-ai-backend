require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://dmarsystems.com',
  'https://www.dmarssystems.com',
  'https://dmarssystems.com',
  'https://www.dmarssystems.com'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  }
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'DMARS AI backend running' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const start = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 400,
        temperature: 0.3
      })
    });

    console.log(`Groq latency: ${Date.now() - start}ms`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', errText);
      return res.status(502).json({ error: 'Groq API error' });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    res.json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 DMARS AI backend running on port ${PORT}`);
});
