import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, playerName } = req.body;

  console.log('📥 Create game request:', { roomCode, playerId, playerName });

  if (!roomCode) {
   return res.status(400).json({
    error: 'Missing roomCode',
    message: 'Room code is required'
   });
  }

  if (!playerId) {
   return res.status(400).json({
    error: 'Missing playerId',
    message: 'Player ID is required'
   });
  }

  // Check if room already exists
  const existingGame = await kv.get(`game:${roomCode}`);
  if (existingGame) {
   console.log(`✅ Room ${roomCode} already exists`);
   return res.status(200).json({
    success: true,
    exists: true,
    roomCode: roomCode,
    message: 'Room already exists'
   });
  }

  // Create new game state
  const gameState = {
   phase: 'waiting',
   currentDay: 0,
   currentCard: 0,
   createdAt: Date.now(),
   players: [playerId]
  };

  // Save game state
  await kv.set(`game:${roomCode}`, gameState);
  console.log(`✅ Game state saved for room ${roomCode}`);

  // Save player name
  await kv.set(`player:${playerId}:name`, playerName || 'Player');
  console.log(`✅ Player name saved for ${playerId}`);

  // Add player to room
  await kv.rpush(`room:${roomCode}:players`, playerId);
  console.log(`✅ Player ${playerId} added to room ${roomCode}`);

  // Verify the room was created
  const verifyGame = await kv.get(`game:${roomCode}`);
  console.log(`✅ Verification - Room ${roomCode} exists:`, !!verifyGame);

  return res.status(200).json({
   success: true,
   created: true,
   roomCode: roomCode,
   message: 'Game created successfully'
  });

 } catch (error) {
  console.error('Error in /api/create-game:', error);
  return res.status(500).json({
   error: 'Failed to create game',
   details: error.message
  });
 }
}