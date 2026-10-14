require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Allowed origins: defaults + optional comma-separated ALLOWED_ORIGINS env var ----
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://dmarsystem.netlify.app',
  'https://dmarsystem.com',
  'https://www.dmarsystem.com',
  'https://dmarssystem.com',
  'https://www.dmarssystem.com'
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

// ---- Startup checks ----
if (!process.env.GROQ_API_KEY) {
  console.error('⚠️  GROQ_API_KEY is NOT set. Every chat request will fail.');
}
if (typeof fetch !== 'function') {
  console.error('⚠️  Global fetch is unavailable. Use Node 18 or newer.');
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    console.warn('CORS blocked origin:', origin);
    return cb(null, false); // no CORS headers -> browser blocks, but server doesn't 500
  }
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'DMARS AI backend running ✅' });
});

// Quick diagnostics without exposing secrets
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    model: GROQ_MODEL,
    allowedOrigins
  });
});

// ---- Model: set GROQ_MODEL on Render to switch without code changes ----
// llama-3.1-8b-instant is now Enterprise-only on Groq, so default to a model on the public plan.
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

function buildGroqBody(messages) {
  const body = { model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 1024 };
  // gpt-oss models reason before answering; keep that short so replies stay fast
  if (GROQ_MODEL.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  return body;
}

// Keep only valid {role, content} pairs Groq accepts
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map(m => {
      if (!m || typeof m.content !== 'string' || !m.content.trim()) return null;
      const role = m.role === 'user' ? 'user' : 'assistant'; // 'bot', 'ai', etc. -> assistant
      return { role, content: m.content };
    })
    .filter(Boolean)
    .slice(-10);
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message: userMessage, history = [] } = req.body || {};
    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are DMARS AI, the intelligent assistant for DMARS Technologies — a digital solutions company specializing in web development, digital marketing, AI chatbots, lead handling systems, and business automation. Be professional, helpful, and concise. Represent DMARS positively. Services include: web apps, landing pages, Meta Ads, AI chatbots, WhatsApp automation, and demand-to-revenue systems.`
      },
      ...cleanHistory(history),
      { role: 'user', content: userMessage }
    ];

    const start = Date.now();
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(buildGroqBody(messages))
    });
    console.log(`Groq status ${response.status}, latency ${Date.now() - start}ms`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return res.status(502).json({ error: 'Groq API error', status: response.status });
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
  console.log('Allowed origins:', allowedOrigins.join(', '));
  console.log('Groq model:', GROQ_MODEL);
});
