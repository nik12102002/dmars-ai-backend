'use strict';

const Groq   = require('groq-sdk');
const logger = require('../lib/logger');
const { buildSystemPrompt } = require('../prompts/systemPrompt');

/* ─────────────────────────────────────────
   Startup guard
───────────────────────────────────────── */
if (!process.env.GROQ_API_KEY) {
  logger.error('GROQ_API_KEY missing — groqService cannot initialize');
  process.exit(1);
}

/* ─────────────────────────────────────────
   Groq client — timeout + retries configured
───────────────────────────────────────── */
const groq = new Groq({
  apiKey:     process.env.GROQ_API_KEY,
  timeout:    parseInt(process.env.GROQ_TIMEOUT_MS || '15000', 10),
  maxRetries: 2
});

const CONFIG = {
  MODEL:       process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile',
  MAX_TOKENS:  parseInt(process.env.GROQ_MAX_TOKENS  || '400', 10),
  TEMPERATURE: parseFloat(process.env.GROQ_TEMPERATURE || '0.5'),
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY_TURNS  || '10', 10),
};

/* ─────────────────────────────────────────
   getAIReply
───────────────────────────────────────── */
async function getAIReply({ message, intent, leadScore, leadStatus, history = [], reqId }) {
  const systemContent = buildSystemPrompt(intent, leadScore, leadStatus);

  const safeHistory = Array.isArray(history)
    ? history.slice(-(CONFIG.MAX_HISTORY * 2))
    : [];

  const messages = [
    { role: 'system', content: systemContent },
    ...safeHistory,
    { role: 'user',   content: message }  // ✅ Fixed: clean message only, no prefix pollution
  ];

  const start = Date.now();

  const completion = await groq.chat.completions.create({
    model:       CONFIG.MODEL,
    messages,
    max_tokens:  CONFIG.MAX_TOKENS,
    temperature: CONFIG.TEMPERATURE,
    stream:      false
  });

  const latency      = Date.now() - start;
  const reply        = completion.choices?.[0]?.message?.content?.trim()
                       || "I'm sorry, I had trouble responding. Please try again.";
  const inputTokens  = completion.usage?.prompt_tokens;
  const outputTokens = completion.usage?.completion_tokens;

  logger.info('Groq reply generated', {
    reqId,
    latencyMs: latency,
    model:     CONFIG.MODEL,
    intent,
    leadStatus,
    inputTokens,
    outputTokens
  });

  return { reply, latency, inputTokens, outputTokens };
}

module.exports = { getAIReply };
