import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Helper function to get total cards for a day
function getTotalCardsForDay(dayIndex) {
 try {
  const questionsPath = path.join(process.cwd(), 'public', 'questions.json');
  if (fs.existsSync(questionsPath)) {
   const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
   if (data.days && data.days[dayIndex]) {
    return data.days[dayIndex].cards.length;
   }
  }
 } catch (error) {
  console.error('Error reading questions.json:', error);
 }
 return 4;
}

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

  const currentDay = gameState.currentDay || 0;
  const currentCard = gameState.currentCard || 0;
  const totalCards = getTotalCardsForDay(currentDay);

  console.log(`📄 Day ${currentDay + 1}, Card ${currentCard + 1}/${totalCards}`);

  // Move to next card
  gameState.phase = 'playing';
  gameState.currentCard = currentCard + 1;

  // Check if we've completed all cards for this day
  if (gameState.currentCard >= totalCards) {
   // Reset card to 0 and move to next day
   gameState.currentCard = 0;
   gameState.currentDay = currentDay + 1;

   console.log(`📆 Moving to Day ${gameState.currentDay + 1}`);

   // ============ CRITICAL: Clear answers for the new day ============
   // This ensures old answers don't interfere with the new day
   const newDay = gameState.currentDay;
   const newCard = 0;
   const answersKey = `room:${roomCode}:day:${newDay}:card:${newCard}:answers`;
   // Delete any existing answers for this new day/card
   await kv.del(answersKey);
   console.log(`🗑️ Cleared answers for Day ${newDay + 1}, Card 1`);

   // Check if game is complete (5 days)
   if (gameState.currentDay >= 5) {
    gameState.phase = 'complete';
    await kv.set(`game:${roomCode}`, gameState);
    console.log(`🏁 Game complete in room ${roomCode}!`);
    return res.status(200).json({
     success: true,
     phase: 'complete',
     message: 'Game complete!'
    });
   }
  }

  // Save the updated game state
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