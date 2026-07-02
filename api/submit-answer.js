import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, choice, customText } = req.body;

  if (!roomCode || !playerId || !choice) {
   return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get current game state
  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  const day = gameState.currentDay;
  const card = gameState.currentCard;

  // Store the answer with a timestamp
  const answersKey = `room:${roomCode}:day:${day}:card:${card}:answers`;
  const answerData = JSON.stringify({
   choice,
   customText,
   timestamp: Date.now(),
   playerId
  });

  await kv.hset(answersKey, {
   [playerId]: answerData
  });

  // Get all players in the room
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1);

  // Get all answers for this card
  const answers = await kv.hgetall(answersKey);

  // Check if ALL players have answered
  let allAnswered = true;
  for (const player of players) {
   if (!answers[player]) {
    allAnswered = false;
    break;
   }
  }

  // If all answered, move to reveal phase
  if (allAnswered) {
   gameState.phase = 'reveal';
   await kv.set(`game:${roomCode}`, gameState);

   // Also store the answers in a permanent location
   const allAnswersKey = `room:${roomCode}:day:${day}:card:${card}:all_answers`;
   await kv.set(allAnswersKey, answers);
  }

  res.status(200).json({
   success: true,
   allAnswered,
   totalPlayers: players.length,
   answeredCount: Object.keys(answers).length,
   message: allAnswered ? 'All players have answered!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error submitting answer:', error);
  res.status(500).json({
   error: 'Failed to submit answer',
   details: error.message
  });
 }
}