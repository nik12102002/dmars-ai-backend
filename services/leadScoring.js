'use strict';

/* ─────────────────────────────────────────
   Scoring rules — each keyword group has weight + word boundary check
───────────────────────────────────────── */
const SCORING_RULES = [
  { pattern: /\bai\b/i,                                           points: 10 },
  { pattern: /\bautomation\b/i,                                   points: 20 },
  { pattern: /\b(pricing|price|cost|how much)\b/i,                points: 30 },
  { pattern: /\b(consultation|consult|strategy call|discovery)\b/i, points: 50 },
  { pattern: /\b(book|schedule a call|schedule a demo)\b/i,       points: 100 },
  { pattern: /\b(ready to start|let's go|sign me up|get started)\b/i, points: 80 },
  { pattern: /\b(chatbot|whatsapp|lead generation|landing page)\b/i, points: 15 },
];

const MAX_SCORE = 500;

const STATUS_THRESHOLDS = [
  { min: 101, label: 'Qualified' },
  { min: 80,  label: 'Hot'       },
  { min: 50,  label: 'Warm'      },
  { min: 20,  label: 'Curious'   },
  { min: 0,   label: 'Cold'      },
];

function getStatus(score) {
  for (const threshold of STATUS_THRESHOLDS) {
    if (score >= threshold.min) return threshold.label;
  }
  return 'Cold';
}

function scoreLead(message, currentScore = 0) {
  if (typeof message !== 'string') return { score: currentScore, status: getStatus(currentScore) };

  let delta = 0;

  for (const rule of SCORING_RULES) {
    if (rule.pattern.test(message)) {
      delta += rule.points;
    }
  }

  // ✅ Fixed: cap score, floor at 0
  const score  = Math.min(MAX_SCORE, Math.max(0, currentScore + delta));
  const status = getStatus(score);

  return { score, status, delta };
}

module.exports = { scoreLead, getStatus };
