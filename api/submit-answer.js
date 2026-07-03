import { kv } from '@vercel/kv';

export default async function handler(req, res) {
 if (req.method !== 'POST') {
  return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
  const { roomCode, playerId, choice, customText } = req.body;

  if (!roomCode || !playerId || !choice) {
   return res.status(400).json({ error: 'Missing required fields' });
  }

  const gameState = await kv.get(`game:${roomCode}`);
  if (!gameState) {
   return res.status(404).json({ error: 'Game not found' });
  }

  if (gameState.phase !== 'playing') {
   return res.status(400).json({ error: 'Game is not in playing phase' });
  }

  const day = gameState.currentDay || 0;
  const card = gameState.currentCard || 0;
  const answersKey = `room:${roomCode}:day:${day}:card:${card}:answers`;

  const answerData = JSON.stringify({
   choice,
   customText,
   timestamp: Date.now(),
   playerId
  });

  await kv.hset(answersKey, {
   [playerId]: answerData
  });

  // Get all players in the room
  let players = await kv.lrange(`room:${roomCode}:players`, 0, -1) || [];

  // ============ STRICT 2-PLAYER ENFORCEMENT ============
  // Remove duplicates and only keep active players
  players = [...new Set(players)];

  // Clean stale players
  const activePlayers = [];
  for (const p of players) {
   const name = await kv.get(`player:${p}:name`);
   if (name) activePlayers.push(p);
  }

  if (activePlayers.length !== players.length) {
   await kv.del(`room:${roomCode}:players`);
   for (const p of activePlayers) {
    await kv.rpush(`room:${roomCode}:players`, p);
   }
   players = activePlayers;
   gameState.players = players;
   await kv.set(`game:${roomCode}`, gameState);
  }

  // Get all answers for this card
  const answers = await kv.hgetall(answersKey);

  // Check if ALL players have answered (should be exactly 2)
  let allAnswered = true;
  let answeredCount = 0;
  for (const player of players) {
   if (answers[player]) {
    answeredCount++;
   } else {
    allAnswered = false;
   }
  }

  // If all 2 players answered, move to reveal phase
  if (allAnswered && players.length === 2) {
   gameState.phase = 'reveal';
   await kv.set(`game:${roomCode}`, gameState);
  }

  res.status(200).json({
   success: true,
   allAnswered,
   totalPlayers: players.length,
   answeredCount: answeredCount,
   phase: gameState.phase,
   message: allAnswered ? 'All players have answered!' : `Waiting for partner... (${answeredCount}/2)`
  });

 } catch (error) {
  console.error('Error submitting answer:', error);
  res.status(500).json({ error: 'Failed to submit answer' });
 }
}