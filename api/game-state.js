import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { room, playerId } = req.query;

  if (!room || !playerId) {
    return res.status(400).json({ error: 'Missing room or playerId' });
  }

  try {
    // Get game state
    const gameState = await kv.get(`game:${room}`);

    if (!gameState) {
      return res.status(200).json({
        phase: 'not_found',
        error: 'Room not found'
      });
    }

    // Get all players
    const players = await kv.lrange(`room:${room}:players`, 0, -1) || [];

    // Get player names
    const playerNames = {};
    for (const pid of players) {
      const name = await kv.get(`player:${pid}:name`);
      if (name) playerNames[pid] = name;
    }

    // Check if partner is connected
    const partnerId = players.find(id => id !== playerId);
    const partnerConnected = !!partnerId;
    const partnerName = partnerId ? playerNames[partnerId] : null;

    // Get answers for current card if in playing phase
    let answers = {};
    let allAnswered = false;

    if (gameState.phase === 'playing' || gameState.phase === 'reveal') {
      const day = gameState.currentDay || 0;
      const card = gameState.currentCard || 0;
      const answersKey = `room:${room}:day:${day}:card:${card}:answers`;
      const rawAnswers = await kv.hgetall(answersKey) || {};

      // Parse answers
      for (const [key, value] of Object.entries(rawAnswers)) {
        try {
          answers[key] = JSON.parse(value);
        } catch {
          answers[key] = value;
        }
      }

      // Check if all players have answered
      if (players.length > 0) {
        let answeredCount = 0;
        for (const p of players) {
          if (answers[p]) answeredCount++;
        }
        allAnswered = answeredCount === players.length && players.length > 0;
      }
    }

    // Determine if we should auto-transition to reveal
    if (gameState.phase === 'playing' && allAnswered) {
      gameState.phase = 'reveal';
      await kv.set(`game:${room}`, gameState);
    }

    res.status(200).json({
      phase: gameState.phase || 'waiting',
      currentDay: gameState.currentDay || 0,
      currentCard: gameState.currentCard || 0,
      players: players,
      playerNames: playerNames,
      partnerConnected: partnerConnected,
      partnerName: partnerName,
      answers: answers,
      allAnswered: allAnswered,
      isComplete: gameState.phase === 'complete',
      playerId: playerId
    });

  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({
      error: 'Failed to get game state',
      details: error.message
    });
  }
}