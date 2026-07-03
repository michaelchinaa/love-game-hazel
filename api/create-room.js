import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, playerName } = req.body;

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  // Check if room already exists
  const existingGame = await kv.get(`game:${roomCode}`);
  if (existingGame) {
   return res.status(200).json({
    success: true,
    exists: true,
    message: 'Room already exists'
   });
  }

  // Initialize game state
  const gameState = {
   phase: 'waiting',
   currentDay: 0,
   currentCard: 0,
   players: [playerId],
   createdAt: Date.now()
  };

  await kv.set(`game:${roomCode}`, gameState);
  await kv.set(`player:${playerId}:name`, playerName || 'Player 1');
  await kv.rpush(`room:${roomCode}:players`, playerId);

  res.status(200).json({
   success: true,
   created: true,
   gameState
  });

 } catch (error) {
  console.error('Error creating room:', error);
  res.status(500).json({ error: 'Failed to create room' });
 }
}