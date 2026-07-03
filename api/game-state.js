import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { room, playerId } = req.query;

  console.log('📊 Game state request:', { room, playerId });

  if (!room || !playerId) {
    return res.status(400).json({ error: 'Missing room or playerId' });
  }

  try {
    // First, try to get the game state
    let gameState = null;
    try {
      gameState = await kv.get(`game:${room}`);
    } catch (kvError) {
      console.error('❌ KV Error in game-state:', kvError);
      return res.status(500).json({
        phase: 'error',
        error: 'Database error',
        details: kvError.message
      });
    }

    if (!gameState) {
      console.log(`❌ Room ${room} not found in KV`);

      // Check if the room exists but is empty
      const players = await kv.lrange(`room:${room}:players`, 0, -1) || [];
      if (players.length > 0) {
        console.log(`⚠️ Room ${room} has players but no game state`);
        // Recreate the game state
        gameState = {
          phase: 'waiting',
          currentDay: 0,
          currentCard: 0,
          createdAt: Date.now(),
          players: players
        };
        await kv.set(`game:${room}`, gameState);
        console.log(`✅ Recreated game state for ${room}`);
      } else {
        return res.status(200).json({
          phase: 'not_found',
          error: 'Room not found'
        });
      }
    }

    console.log(`✅ Room ${room} found:`, gameState);

    // Get players from room
    let players = [];
    try {
      players = await kv.lrange(`room:${room}:players`, 0, -1) || [];
    } catch (err) {
      console.error('❌ Error getting players:', err);
      players = gameState.players || [];
    }
    console.log(`👥 Players in ${room}:`, players);

    // Get player names
    const playerNames = {};
    for (const pid of players) {
      try {
        const name = await kv.get(`player:${pid}:name`);
        if (name) playerNames[pid] = name;
      } catch (err) {
        console.error(`❌ Error getting name for ${pid}:`, err);
      }
    }

    // Check if partner is connected
    const partnerId = players.find(id => id !== playerId);
    const partnerConnected = !!partnerId;
    const partnerName = partnerId ? playerNames[partnerId] : null;

    // Get answers for current card
    let answers = {};
    let allAnswered = false;

    if (gameState.phase === 'playing' || gameState.phase === 'reveal') {
      const day = gameState.currentDay || 0;
      const card = gameState.currentCard || 0;
      const answersKey = `room:${room}:day:${day}:card:${card}:answers`;

      try {
        const rawAnswers = await kv.hgetall(answersKey) || {};
        for (const [key, value] of Object.entries(rawAnswers)) {
          try {
            answers[key] = JSON.parse(value);
          } catch {
            answers[key] = value;
          }
        }
      } catch (err) {
        console.error('❌ Error getting answers:', err);
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

    // Auto-transition to reveal if all answered
    if (gameState.phase === 'playing' && allAnswered) {
      gameState.phase = 'reveal';
      try {
        await kv.set(`game:${room}`, gameState);
        console.log(`🔄 Room ${room} transitioned to reveal phase`);
      } catch (err) {
        console.error('❌ Error updating game state:', err);
      }
    }

    return res.status(200).json({
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
    console.error('❌ Error in /api/game-state:', error);
    return res.status(500).json({
      phase: 'error',
      error: 'Failed to get game state',
      details: error.message
    });
  }
}