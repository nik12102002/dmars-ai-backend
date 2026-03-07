function scoreLead(message, currentScore = 0) {
  const text = message.toLowerCase();
  let score = currentScore;

  if (text.includes('ai')) score += 10;
  if (text.includes('automation')) score += 20;
  if (text.includes('pricing') || text.includes('price') || text.includes('cost')) score += 30;
  if (text.includes('consultation') || text.includes('consult') || text.includes('strategy call')) score += 50;
  if (text.includes('book') || text.includes('schedule a call')) score += 100;

  let status = 'Cold';
  if (score > 100) status = 'Qualified';
  else if (score >= 80) status = 'Hot';
  else if (score >= 50) status = 'Warm';
  else if (score >= 20) status = 'Curious';

  return { score, status };
}

module.exports = { scoreLead };
