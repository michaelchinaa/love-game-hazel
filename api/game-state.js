import { kv } from '@vercel/kv';

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

    // ============ STRICT 2-PLAYER ENFORCEMENT ============
    // Remove duplicates
    players = [...new Set(players)];

    // Only keep players that have a name (active players)
    const activePlayers = [];
    for (const p of players) {
      const name = await kv.get(`player:${p}:name`);
      if (name) {
        activePlayers.push(p);
      }
    }

    // If active players is different, update the room
    if (activePlayers.length !== players.length) {
      console.log(`🧹 Game-state cleanup: ${players.length} -> ${activePlayers.length}`);
      await kv.del(`room:${room}:players`);
      for (const p of activePlayers) {
        await kv.rpush(`room:${room}:players`, p);
      }
      players = activePlayers;
      gameState.players = players;
      await kv.set(`game:${room}`, gameState);
    }

    console.log(`👥 Players in ${room}:`, players);

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

      if (players.length > 0) {
        let answeredCount = 0;
        for (const p of players) {
          if (answers[p]) answeredCount++;
        }
        allAnswered = answeredCount === players.length && players.length === 2;
      }
    }

    if (gameState.phase === 'playing' && allAnswered) {
      gameState.phase = 'reveal';
      await kv.set(`game:${room}`, gameState);
      console.log(`🔄 Room ${room} transitioned to reveal phase`);
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