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

  // Get game state
  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Room not found' });
  }

  // Get existing players
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1);

  // Check if player already in room
  if (!players.includes(playerId)) {
   await kv.rpush(`room:${roomCode}:players`, playerId);
   players.push(playerId);
  }

  // Store player name
  await kv.set(`player:${playerId}:name`, playerName || 'Player');

  // Update game state with players
  gameState.players = players;

  // If 2 players, start the game
  if (players.length >= 2) {
   gameState.phase = 'playing';
  }

  await kv.set(`game:${roomCode}`, gameState);

  res.status(200).json({
   success: true,
   phase: gameState.phase,
   players: players,
   isReady: players.length >= 2
  });

 } catch (error) {
  console.error('Error joining room:', error);
  res.status(500).json({ error: 'Failed to join room' });
 }
}