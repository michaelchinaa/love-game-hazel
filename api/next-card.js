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

  let { currentDay, currentCard, phase } = gameState;

  // Move to next card
  currentCard += 1;

  // Check if we need to move to next day
  // You'll need to know the total cards per day
  // This assumes 5 cards per day (adjust as needed)
  const cardsPerDay = 5;
  if (currentCard >= cardsPerDay) {
   currentCard = 0;
   currentDay += 1;
   phase = 'playing';
  }

  // Update game state
  const newState = { currentDay, currentCard, phase };
  await kv.set(`game:${roomCode}`, newState);

  res.status(200).json({
   success: true,
   currentDay,
   currentCard,
   phase
  });

 } catch (error) {
  console.error('Error in next-card:', error);
  res.status(500).json({ error: 'Failed to advance to next card' });
 }
}