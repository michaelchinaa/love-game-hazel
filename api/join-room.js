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
  let gameState = null;
  try {
   gameState = await kv.get(`game:${roomCode}`);
  } catch (kvError) {
   console.error('❌ KV Error checking room:', kvError);
   return res.status(500).json({
    success: false,
    error: 'Database connection error'
   });
  }

  if (!gameState) {
   console.log(`❌ Room ${roomCode} not found in KV`);

   // Check if there are players in the room (partial state)
   const players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];
   if (players.length > 0) {
    // Recreate the game state
    gameState = {
     phase: 'waiting',
     currentDay: 0,
     currentCard: 0,
     createdAt: Date.now(),
     players: players
    };
    await kv.set(`game:${roomCode}`, gameState);
    console.log(`✅ Recreated game state for ${roomCode}`);
   } else {
    return res.status(404).json({
     success: false,
     error: 'Room not found. Please check the room code and try again.'
    });
   }
  }

  console.log(`✅ Room ${roomCode} found`);

  // Save player name
  try {
   await kv.set(`player:${playerId}:name`, playerName || 'Player');
  } catch (err) {
   console.error('❌ Error saving player name:', err);
  }

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
  const isReady = players.length >= 2;
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
   message: isReady ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('❌ Error in /api/join-room:', error);
  return res.status(500).json({
   success: false,
   error: 'Failed to join room',
   details: error.message
  });
 }
}