import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST' && req.method !== 'GET') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode } = req.method === 'POST' ? req.body : req.query;

  if (!roomCode) {
   return res.status(400).json({ error: 'Missing roomCode' });
  }

  console.log(`🧹 Cleaning up room: ${roomCode}`);

  // Get players
  let players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];

  // Remove duplicates
  players = [...new Set(players)];

  // Only keep players with names
  const activePlayers = [];
  for (const p of players) {
   const name = await kv.get(`player:${p}:name`);
   if (name) {
    activePlayers.push(p);
   }
  }

  // Limit to exactly 2 players (keep the first 2)
  const cleanedPlayers = activePlayers.slice(0, 2);

  // Update room with clean player list
  await kv.del(`room:${roomCode}:players`);
  for (const p of cleanedPlayers) {
   await kv.rpush(`room:${roomCode}:players`, p);
  }

  // Update game state
  const gameState = await kv.get(`game:${roomCode}`);
  if (gameState) {
   gameState.players = cleanedPlayers;
   await kv.set(`game:${roomCode}`, gameState);
  }

  return res.status(200).json({
   success: true,
   message: 'Room cleaned up to 2 players',
   originalCount: players.length,
   cleanedCount: cleanedPlayers.length,
   players: cleanedPlayers
  });

 } catch (error) {
  console.error('Error cleaning up room:', error);
  return res.status(500).json({
   error: 'Failed to cleanup room',
   details: error.message
  });
 }
}