import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 try {
  const { roomCode } = req.query;

  let results = [];

  if (roomCode) {
   // Get specific room results
   const result = await kv.get(`results:${roomCode}`);
   if (result) {
    results = [result];
   }
  } else {
   // Get all results
   const roomCodes = await kv.lrange('results:all', 0, -1);
   for (const code of roomCodes) {
    const result = await kv.get(`results:${code}`);
    if (result) {
     results.push(result);
    }
   }
  }

  return res.status(200).json({
   success: true,
   results,
   total: results.length
  });

 } catch (error) {
  console.error('Error getting results:', error);
  return res.status(500).json({
   error: 'Failed to get results',
   details: error.message
  });
 }
}