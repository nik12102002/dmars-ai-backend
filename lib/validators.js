'use strict';

const Joi = require('joi');

/* ─────────────────────────────────────────
   Prompt injection patterns to block
───────────────────────────────────────── */
const BLOCKED_PATTERNS = [
  /ignore\s+(previous|all)\s+instructions/i,
  /disregard\s+(previous|all)\s+instructions/i,
  /you\s+are\s+now\s+[a-z]/i,
  /act\s+as\s+if\s+you\s+are/i,
  /forget\s+(everything|all)\s+(you|above)/i,
  /new\s+instructions\s*:/i,
  /system\s+prompt\s*:/i,
  /<\s*script[\s\S]*?>/i,
  /javascript\s*:/i,
];

/* ─────────────────────────────────────────
   Sanitize — strip null bytes + trim
───────────────────────────────────────── */
function sanitize(str) {
  return str.replace(/\0/g, '').trim();
}

/* ─────────────────────────────────────────
   Message-only validator (returns string error or null)
───────────────────────────────────────── */
function validateMessage(message) {
  if (!message || typeof message !== 'string') return 'Message is required.';

  const trimmed = sanitize(message);
  if (trimmed.length < 2)    return 'Message is too short.';
  if (trimmed.length > 1200) return 'Message is too long.';

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return 'Message contains disallowed content.';
  }

  return null; // ✅ null = valid
}

/* ─────────────────────────────────────────
   Full chat body schema (Joi) — used in chat.js
───────────────────────────────────────── */
const historyItem = Joi.object({
  role:    Joi.string().valid('user', 'assistant').required(),
  content: Joi.string().min(1).max(1200).required()
});

const chatBodySchema = Joi.object({
  message:      Joi.string().min(2).max(1200).required(),
  sessionId:    Joi.string().max(128).optional().allow(null, ''),
  history:      Joi.array().items(historyItem).max(20).default([]),
  currentScore: Joi.number().min(0).max(500).default(0),
  name:         Joi.string().max(100).optional().allow(null, ''),
  email:        Joi.string().email().optional().allow(null, ''),
  company:      Joi.string().max(200).optional().allow(null, '')
});

function validateChatBody(body) {
  const { error, value } = chatBodySchema.validate(body, {
    abortEarly:    false,
    stripUnknown:  true
  });

  if (error) {
    return {
      valid:   false,
      errors:  error.details.map(d => d.message),
      value:   null
    };
  }

  // Secondary prompt injection check on validated message
  const injectionError = validateMessage(value.message);
  if (injectionError) {
    return { valid: false, errors: [injectionError], value: null };
  }

  return { valid: true, errors: null, value };
}

module.exports = { validateMessage, validateChatBody };
