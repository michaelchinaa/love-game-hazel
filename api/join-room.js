import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, playerName } = req.body;

  console.log('🔗 Join room request:', { roomCode, playerId, playerName });

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  // Check if room exists
  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   console.log(`❌ Room ${roomCode} not found in KV`);
   return res.status(404).json({
    success: false,
    error: 'Room not found. Please check the room code and try again.',
    code: 'ROOM_NOT_FOUND'
   });
  }

  console.log(`✅ Room ${roomCode} found`);

  // Save player name
  await kv.set(`player:${playerId}:name`, playerName || 'Player');

  // Get existing players
  let players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];

  // Add player if not already in room
  if (!players.includes(playerId)) {
   await kv.rpush(`room:${roomCode}:players`, playerId);
   players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];
  }

  console.log(`👥 Players in ${roomCode}:`, players);

  // Update game state
  gameState.players = players;

  // If 2 players, start the game
  if (players.length >= 2 && gameState.phase === 'waiting') {
   gameState.phase = 'playing';
   console.log(`🎮 Game starting in ${roomCode}!`);
  }

  await kv.set(`game:${roomCode}`, gameState);

  return res.status(200).json({
   success: true,
   phase: gameState.phase,
   players: players,
   isReady: players.length >= 2,
   message: players.length >= 2 ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error in /api/join-room:', error);
  return res.status(500).json({
   success: false,
   error: 'Failed to join room',
   details: error.message
  });
 }
}