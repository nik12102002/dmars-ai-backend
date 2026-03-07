const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function saveLeadEvent(payload) {
  const { data, error } = await supabase
    .from('lead_events')
    .insert([payload])
    .select();

  if (error) throw error;
  return data;
}

module.exports = { saveLeadEvent };
