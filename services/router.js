function detectIntent(message) {
  const text = message.toLowerCase();

  if (
    text.includes('price') ||
    text.includes('pricing') ||
    text.includes('cost') ||
    text.includes('book') ||
    text.includes('consult')
  ) {
    return 'sales';
  }

  if (
    text.includes('not working') ||
    text.includes('bug') ||
    text.includes('issue') ||
    text.includes('help')
  ) {
    return 'support';
  }

  if (
    text.includes('automation') ||
    text.includes('architecture') ||
    text.includes('workflow') ||
    text.includes('chatbot for my business')
  ) {
    return 'automation_engineer';
  }

  return 'sales';
}

module.exports = { detectIntent };
