const express = require('express');
const router = express.Router();

const { validateMessage } = require('../lib/validators');
const { detectIntent } = require('../services/router');
const { scoreLead } = require('../services/leadScoring');
const { getAIReply } = require('../services/groqService');
const { saveLeadEvent } = require('../services/supabaseService');

router.post('/', async function (req, res) {
  try {
    const {
      message,
      sessionId,
      history = [],
      currentScore = 0,
      name = null,
      email = null,
      company = null
    } = req.body;

    const error = validateMessage(message);
    if (error) {
      return res.status(400).json({ error });
    }

    const intent = detectIntent(message);
    const scored = scoreLead(message, currentScore);
    const score = scored.score;
    const status = scored.status;

    let reply = await getAIReply({
      message,
      intent,
      leadScore: score,
      leadStatus: status,
      history
    });

    const shouldOfferBooking = score >= 50;

    if (shouldOfferBooking) {
      reply += '\n\nBook a free consultation here: ' + process.env.CALENDLY_LINK;
    }

    await saveLeadEvent({
      session_id: sessionId || ('sess_' + Date.now()),
      user_message: message,
      ai_reply: reply,
      intent,
      lead_score: score,
      lead_status: status,
      name,
      email,
      company,
      booking_link_shown: shouldOfferBooking
    });

    res.json({
      reply,
      intent,
      leadScore: score,
      leadStatus: status,
      bookingLinkShown: shouldOfferBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

module.exports = router;
