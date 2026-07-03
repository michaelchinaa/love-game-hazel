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
  let gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({
    success: false,
    error: 'Room not found. Please check the room code and try again.'
   });
  }

  // Get existing players and clean duplicates
  let players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];

  // ============ STRICT 2-PLAYER ENFORCEMENT ============
  // Remove duplicates
  players = [...new Set(players)];

  // Check if room is full (2 players max)
  if (players.length >= 2 && !players.includes(playerId)) {
   return res.status(400).json({
    success: false,
    error: 'Room is full. Maximum 2 players allowed.',
    code: 'ROOM_FULL'
   });
  }

  // Save player name
  await kv.set(`player:${playerId}:name`, playerName || 'Player');

  // Add player if not already in room
  if (!players.includes(playerId)) {
   await kv.rpush(`room:${roomCode}:players`, playerId);
   players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];
   players = [...new Set(players)]; // Clean again
  }

  console.log(`👥 Players in ${roomCode}:`, players);

  // Update game state
  gameState.players = players;

  // If 2 players, start the game
  const isReady = players.length === 2;
  if (isReady && gameState.phase === 'waiting') {
   gameState.phase = 'playing';
   console.log(`🎮 Game starting in ${roomCode}!`);
  }

  await kv.set(`game:${roomCode}`, gameState);

  return res.status(200).json({
   success: true,
   phase: gameState.phase,
   players: players,
   isReady: isReady,
   message: isReady ? 'Game ready to start!' : 'Waiting for partner... (1/2)',
   playerCount: players.length
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