import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

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
  const { room, playerId } = req.query;

  console.log('📊 Game state request:', { room, playerId });

  if (!room || !playerId) {
    return res.status(400).json({ error: 'Missing room or playerId' });
  }

  try {
    let gameState = await kv.get(`game:${room}`);

    if (!gameState) {
      console.log(`❌ Room ${room} not found in KV`);
      return res.status(200).json({
        phase: 'not_found',
        error: 'Room not found'
      });
    }

    // Get players from room
    let players = await kv.lrange(`room:${room}:players`, 0, -1) || [];
    players = [...new Set(players)];

    // Get player names
    const playerNames = {};
    for (const pid of players) {
      const name = await kv.get(`player:${pid}:name`);
      if (name) playerNames[pid] = name;
    }

    const partnerId = players.find(id => id !== playerId);
    const partnerConnected = !!partnerId;
    const partnerName = partnerId ? playerNames[partnerId] : null;

    let answers = {};
    let allAnswered = false;

    if (gameState.phase === 'playing' || gameState.phase === 'reveal') {
      const day = gameState.currentDay || 0;
      const card = gameState.currentCard || 0;
      const answersKey = `room:${room}:day:${day}:card:${card}:answers`;
      const rawAnswers = await kv.hgetall(answersKey) || {};

      for (const [key, value] of Object.entries(rawAnswers)) {
        try {
          answers[key] = JSON.parse(value);
        } catch {
          answers[key] = value;
        }
      }

      // Only check if all answered if there are exactly 2 players
      if (players.length === 2) {
        let answeredCount = 0;
        for (const p of players) {
          if (answers[p]) answeredCount++;
        }
        allAnswered = answeredCount === players.length;
      }
    }

    // Only auto-transition to reveal if all answered AND phase is playing
    if (gameState.phase === 'playing' && allAnswered && players.length === 2) {
      gameState.phase = 'reveal';
      await kv.set(`game:${room}`, gameState);
      console.log(`🔄 Room ${room} transitioned to reveal phase`);
    }

    const totalCards = getTotalCardsForDay(gameState.currentDay || 0);

    return res.status(200).json({
      phase: gameState.phase || 'waiting',
      currentDay: gameState.currentDay || 0,
      currentCard: gameState.currentCard || 0,
      totalCards: totalCards,
      players: players,
      playerNames: playerNames,
      partnerConnected: partnerConnected,
      partnerName: partnerName,
      answers: answers,
      allAnswered: allAnswered,
      isComplete: gameState.phase === 'complete',
      playerId: playerId,
      playerCount: players.length
    });

  } catch (error) {
    console.error('Error getting game state:', error);
    return res.status(500).json({
      error: 'Failed to get game state',
      details: error.message
    });
  }
}