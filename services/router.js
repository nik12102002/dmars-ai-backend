'use strict';

/* ─────────────────────────────────────────
   Intent detection — word boundary patterns
   Order matters: first match wins
───────────────────────────────────────── */
const INTENT_RULES = [
  {
    intent:   'sales',
    patterns: [
      /\b(price|pricing|cost|how much|package|plan|quote|budget)\b/i,
      /\b(book|consult|consultation|strategy call|discovery call|schedule)\b/i,
    ]
  },
  {
    intent:   'support',
    patterns: [
      /\b(not working|broken|bug|issue|error|problem|fix|crash|down)\b/i,
      /\b(help with|need help|having trouble|can't|cannot)\b/i,
    ]
  },
  {
    intent:   'automation_engineer',
    patterns: [
      /\b(automation|workflow|architecture|pipeline|integration|api|webhook)\b/i,
      /\b(chatbot for my business|ai system|build a bot|custom bot)\b/i,
    ]
  },
];

const DEFAULT_INTENT = 'general';

function detectIntent(message) {
  if (!message || typeof message !== 'string') return DEFAULT_INTENT;

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        return rule.intent;
      }
    }
  }

  return DEFAULT_INTENT;
}

module.exports = { detectIntent };
