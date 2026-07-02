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

  // Store the answer
  const answersKey = `room:${roomCode}:day:${day}:card:${card}:answers`;
  await kv.hset(answersKey, {
   [playerId]: JSON.stringify({ choice, customText, timestamp: Date.now() })
  });

  // Check if both players have answered
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1);
  const answers = await kv.hgetall(answersKey);
  const allAnswered = players.every(p => answers[p] !== undefined);

  if (allAnswered) {
   // Move to reveal phase
   await kv.hset(`game:${roomCode}`, { phase: 'reveal' });
  }

  res.status(200).json({
   success: true,
   allAnswered,
   message: 'Answer submitted successfully'
  });

 } catch (error) {
  console.error('Error submitting answer:', error);
  res.status(500).json({ error: 'Failed to submit answer' });
 }
}