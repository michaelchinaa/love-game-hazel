import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, playerName } = req.body;

  console.log('📝 Ready request:', { roomCode, playerId, playerName });

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  // Check if room exists
  let gameState = await kv.get(`game:${roomCode}`);

  // If room doesn't exist, create it
  if (!gameState) {
   console.log(`🆕 Room ${roomCode} not found, creating...`);
   gameState = {
    phase: 'waiting',
    currentDay: 0,
    currentCard: 0,
    createdAt: Date.now()
   };
   await kv.set(`game:${roomCode}`, gameState);
   console.log(`✅ Room ${roomCode} created`);
  }

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

  // Check if game should start (2 players)
  const isReady = players.length >= 2;
  if (isReady && gameState.phase === 'waiting') {
   gameState.phase = 'playing';
   console.log(`🎮 Game starting in ${roomCode}!`);
  }

  // Save updated game state
  await kv.set(`game:${roomCode}`, gameState);

  return res.status(200).json({
   success: true,
   phase: gameState.phase,
   players: players,
   isReady: isReady,
   message: isReady ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error in /api/ready:', error);
  return res.status(500).json({
   error: 'Failed to mark ready',
   details: error.message
  });
 }
}