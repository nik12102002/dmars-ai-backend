'use strict';

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const { validateChatBody } = require('../lib/validators');
const { detectIntent }     = require('../services/router');
const { scoreLead }        = require('../services/leadScoring');
const { getAIReply }       = require('../services/groqService');
const { saveLeadEvent }    = require('../services/supabaseService');
const logger               = require('../lib/logger');

router.post('/', async function (req, res) {
  const reqId = req.id || crypto.randomUUID();

  /* ── Validate + sanitize full body ── */
  const { valid, errors, value } = validateChatBody(req.body);
  if (!valid) {
    logger.warn('Chat validation failed', { reqId, errors });
    return res.status(400).json({ error: 'Invalid request', details: errors });
  }

  const {
    message,
    sessionId,
    history,
    currentScore,
    name,
    email,
    company
  } = value;

  /* ── Intent + lead scoring ── */
  const intent          = detectIntent(message);
  const { score, status, delta } = scoreLead(message, currentScore);
  const shouldOfferBooking = score >= 50;

  /* ── AI reply ── */
  let reply, latency, inputTokens, outputTokens;

  try {
    ({ reply, latency, inputTokens, outputTokens } = await getAIReply({
      message,
      intent,
      leadScore:  score,
      leadStatus: status,
      history,
      reqId
    }));
  } catch (err) {
    // Handle specific Groq error types cleanly
    if (err.status === 429) {
      logger.warn('Groq rate limit', { reqId });
      return res.status(429).json({ error: 'AI is busy — please try again in a moment.' });
    }
    if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT') {
      logger.error('Groq timeout', { reqId });
      return res.status(504).json({ error: 'Request timed out — please try again.' });
    }
    logger.error('getAIReply failed', { reqId, error: err.message });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  /* ── Append Calendly link if score threshold met ── */
  if (shouldOfferBooking && process.env.CALENDLY_LINK) {
    reply += `\n\n📅 Book a free strategy call: ${process.env.CALENDLY_LINK}`;
  }

  /* ── Save lead event — non-fatal, runs after response ── */
  const safeSessionId = sessionId || `sess_${crypto.randomUUID()}`;

  // ✅ Fire-and-forget — Supabase failure never blocks the user response
  saveLeadEvent({
    session_id:          safeSessionId,
    user_message:        message,
    ai_reply:            reply,
    intent,
    lead_score:          score,
    lead_score_delta:    delta,
    lead_status:         status,
    name:                name    || null,
    email:               email   || null,
    company:             company || null,
    booking_link_shown:  shouldOfferBooking
  }, reqId).catch(() => {}); // already logged inside saveLeadEvent

  /* ── Respond ── */
  logger.info('Chat response sent', { reqId, intent, score, status, latencyMs: latency });

  return res.json({
    reply,
    intent,
    leadScore:        score,
    leadStatus:       status,
    bookingLinkShown: shouldOfferBooking,
    ...(process.env.NODE_ENV !== 'production' && {
      meta: { reqId, latencyMs: latency, inputTokens, outputTokens, scoreDelta: delta }
    })
  });
});

module.exports = router;
