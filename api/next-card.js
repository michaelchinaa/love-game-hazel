import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId } = req.body;

  if (!roomCode) {
   return res.status(400).json({ error: 'Missing roomCode' });
  }

  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  gameState.phase = 'playing';
  gameState.currentCard = (gameState.currentCard || 0) + 1;

  const cardsPerDay = 5;
  if (gameState.currentCard >= cardsPerDay) {
   gameState.currentCard = 0;
   gameState.currentDay = (gameState.currentDay || 0) + 1;

   if (gameState.currentDay >= 5) {
    gameState.phase = 'complete';
    await kv.set(`game:${roomCode}`, gameState);
    return res.status(200).json({
     success: true,
     phase: 'complete',
     message: 'Game complete!'
    });
   }
  }

  await kv.set(`game:${roomCode}`, gameState);

  res.status(200).json({
   success: true,
   currentDay: gameState.currentDay,
   currentCard: gameState.currentCard,
   phase: gameState.phase
  });

 } catch (error) {
  console.error('Error in next-card:', error);
  res.status(500).json({ error: 'Failed to advance to next card' });
 }
}