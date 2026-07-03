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

  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  if (gameState.phase !== 'playing') {
   return res.status(400).json({ error: 'Game is not in playing phase' });
  }

  const day = gameState.currentDay || 0;
  const card = gameState.currentCard || 0;
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

  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];
  const answers = await kv.hgetall(answersKey);

  let allAnswered = true;
  let answeredCount = 0;
  for (const player of players) {
   if (answers[player]) {
    answeredCount++;
   } else {
    allAnswered = false;
   }
  }

  if (allAnswered && players.length >= 2) {
   gameState.phase = 'reveal';
   await kv.set(`game:${roomCode}`, gameState);
  }

  res.status(200).json({
   success: true,
   allAnswered,
   totalPlayers: players.length,
   answeredCount: answeredCount,
   phase: gameState.phase,
   message: allAnswered ? 'All players have answered!' : `Waiting for partner... (${answeredCount}/${players.length})`
  });

 } catch (error) {
  console.error('Error submitting answer:', error);
  res.status(500).json({ error: 'Failed to submit answer' });
 }
}