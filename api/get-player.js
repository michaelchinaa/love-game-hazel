import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 const { roomCode } = req.query;

 if (!roomCode) {
  return res.status(400).json({ error: 'Missing roomCode' });
 }

 try {
  const players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];

  const playerNames = {};
  for (const pid of players) {
   const name = await kv.get(`player:${pid}:name`);
   if (name) {
    playerNames[pid] = name;
   }
  }

  res.status(200).json({
   success: true,
   players: players,
   playerNames: playerNames
  });

 } catch (error) {
  console.error('Error getting players:', error);
  res.status(500).json({
   error: 'Failed to get players',
   details: error.message
  });
 }
}