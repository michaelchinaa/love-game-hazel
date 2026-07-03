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

  // Get current game state
  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  // Reset phase to playing
  gameState.phase = 'playing';

  // Move to next card
  gameState.currentCard = (gameState.currentCard || 0) + 1;

  // Check if we need to move to next day
  const cardsPerDay = 5; // Adjust based on your actual cards per day
  if (gameState.currentCard >= cardsPerDay) {
   gameState.currentCard = 0;
   gameState.currentDay = (gameState.currentDay || 0) + 1;

   // Check if game is complete (5 days)
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

  // Save updated state
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