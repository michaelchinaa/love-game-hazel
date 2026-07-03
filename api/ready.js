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

  // Store player name
  await kv.set(`player:${playerId}:name`, playerName || 'Player');

  // Get or create game
  let gameState = await kv.get(`game:${roomCode}`);

  if (!gameState) {
   gameState = {
    phase: 'waiting',
    currentDay: 0,
    currentCard: 0,
    createdAt: Date.now()
   };
   await kv.set(`game:${roomCode}`, gameState);
  }

  // Add player to room
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];
  if (!players.includes(playerId)) {
   await kv.rpush(`room:${roomCode}:players`, playerId);
   players.push(playerId);
  }

  // Update game state
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
   isReady: players.length >= 2,
   message: players.length >= 2 ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error in ready:', error);
  res.status(500).json({ error: 'Failed to mark ready' });
 }
}