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
  gameState.currentCard += 1;

  // Check if we need to move to next day
  // You'll need to know the total cards per day
  const cardsPerDay = 5; // Adjust this based on your actual cards per day
  if (gameState.currentCard >= cardsPerDay) {
   gameState.currentCard = 0;
   gameState.currentDay += 1;

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

  // Clean up old answers for new card (optional)
  // We'll keep them for debugging but frontend won't show them

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