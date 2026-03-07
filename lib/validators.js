function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'Message is required.';
  }

  const trimmed = message.trim();

  if (trimmed.length < 2) {
    return 'Message is too short.';
  }

  if (trimmed.length > 2000) {
    return 'Message is too long.';
  }

  const blocked = ['ignore previous instructions', '<script', 'drop table', 'rm -rf'];
  const lowered = trimmed.toLowerCase();

  for (const term of blocked) {
    if (lowered.includes(term)) {
      return 'Message contains blocked content.';
    }
  }

  return null;
}

module.exports = { validateMessage };
