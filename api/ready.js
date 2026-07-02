import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId } = req.body;

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  // Add player to room
  await kv.lpush(`room:${roomCode}:players`, playerId);

  // Get all players
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1);

  // Check if room is full (2 players)
  const isFull = players.length >= 2;

  // If room is full, start the game
  if (isFull) {
   await kv.set(`game:${roomCode}`, {
    phase: 'playing',
    currentDay: 0,
    currentCard: 0
   });
  }

  res.status(200).json({
   success: true,
   isFull,
   players: players
  });

 } catch (error) {
  console.error('Error in ready:', error);
  res.status(500).json({ error: 'Failed to mark ready' });
 }
}