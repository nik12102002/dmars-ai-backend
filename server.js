// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // if using Node 18+, can use global fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Replace this with your Netlify frontend URL
const FRONTEND_URL = 'https://your-netlify-site.netlify.app';

app.use(cors({
  origin: FRONTEND_URL
}));
app.use(express.json());

// HEALTH CHECK
app.get('/', (req, res) => {
  res.json({ status: 'DMARS AI backend running' });
});

// CHAT ENDPOINT
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: 'Message is required' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
        })
      }
    );

    const data = await response.json();

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                  "Sorry, I couldn’t generate a response.";

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 DMARS AI backend running on port ${PORT}`);
});