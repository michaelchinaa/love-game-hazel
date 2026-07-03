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
  let existingGame = null;
  try {
   existingGame = await kv.get(`game:${roomCode}`);
  } catch (kvError) {
   console.error('❌ KV Error checking room:', kvError);
   return res.status(500).json({
    error: 'Database connection error',
    details: kvError.message
   });
  }

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
  try {
   await kv.set(`game:${roomCode}`, gameState);
   console.log(`✅ Game state saved for room ${roomCode}`);
  } catch (saveError) {
   console.error('❌ Error saving game state:', saveError);
   return res.status(500).json({
    error: 'Failed to save game state',
    details: saveError.message
   });
  }

  // Save player name
  try {
   await kv.set(`player:${playerId}:name`, playerName || 'Player');
   console.log(`✅ Player name saved for ${playerId}`);
  } catch (nameError) {
   console.error('❌ Error saving player name:', nameError);
   // Continue anyway
  }

  // Add player to room
  try {
   await kv.rpush(`room:${roomCode}:players`, playerId);
   console.log(`✅ Player ${playerId} added to room ${roomCode}`);
  } catch (playerError) {
   console.error('❌ Error adding player:', playerError);
   // Continue anyway
  }

  // Verify the room was created
  let verifyGame = null;
  try {
   verifyGame = await kv.get(`game:${roomCode}`);
  } catch (verifyError) {
   console.error('❌ Error verifying room:', verifyError);
  }

  console.log(`✅ Verification - Room ${roomCode} exists:`, !!verifyGame);

  if (!verifyGame) {
   return res.status(500).json({
    error: 'Room creation failed',
    message: 'Room was not saved properly'
   });
  }

  return res.status(200).json({
   success: true,
   created: true,
   roomCode: roomCode,
   message: 'Game created successfully'
  });

 } catch (error) {
  console.error('❌ Error in /api/create-game:', error);
  return res.status(500).json({
   error: 'Failed to create game',
   details: error.message
  });
 }
}