import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 const { roomCode } = req.query;

 if (!roomCode) {
  return res.status(400).json({ error: 'Missing roomCode' });
 }

 try {
  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  const allAnswers = [];
  const days = 5; // 5 days total

  for (let day = 0; day < days; day++) {
   // Get total cards for this day (you may want to read from questions.json)
   const totalCards = 4; // Default, adjust as needed

   for (let card = 0; card < totalCards; card++) {
    const answersKey = `room:${roomCode}:day:${day}:card:${card}:all_answers`;
    const answers = await kv.get(answersKey);

    if (answers) {
     // Parse the answers
     const parsedAnswers = {};
     for (const [key, value] of Object.entries(answers)) {
      try {
       parsedAnswers[key] = JSON.parse(value);
      } catch {
       parsedAnswers[key] = value;
      }
     }

     // Add to all answers with day/card info
     allAnswers.push({
      day: day + 1,
      card: card + 1,
      answers: parsedAnswers
     });
    }
   }
  }

  res.status(200).json({
   success: true,
   answers: allAnswers,
   total: allAnswers.length
  });

 } catch (error) {
  console.error('Error getting answers:', error);
  res.status(500).json({
   error: 'Failed to get answers',
   details: error.message
  });
 }
}