'use strict';

const { createClient } = require('@supabase/supabase-js');
const logger = require('../lib/logger');

/* ─────────────────────────────────────────
   Startup guard
───────────────────────────────────────── */
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — lead events will not be saved');
}

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/* ─────────────────────────────────────────
   saveLeadEvent — never throws to caller
   Supabase failure is logged, not fatal
───────────────────────────────────────── */
async function saveLeadEvent(payload, reqId) {
  if (!supabase) {
    logger.warn('Supabase not configured — skipping lead event save', { reqId });
    return null;
  }

  const enriched = {
    ...payload,
    timestamp:  new Date().toISOString(),
    created_at: new Date().toISOString(),
    req_id:     reqId || null
  };

  try {
    const { data, error } = await supabase
      .from('lead_events')
      .insert([enriched])
      .select();

    if (error) {
      logger.error('Supabase insert failed', { reqId, error: error.message, code: error.code });
      return null;
    }

    logger.info('Lead event saved', { reqId, leadStatus: payload.lead_status, score: payload.lead_score });
    return data;

  } catch (err) {
    logger.error('Supabase unexpected error', { reqId, error: err.message });
    return null;
  }
}

module.exports = { saveLeadEvent };
