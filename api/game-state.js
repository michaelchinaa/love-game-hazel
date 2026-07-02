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
      const players = await kv.lrange(`room:${room}:players`, 0, -1);
      return res.status(200).json({
        phase: 'waiting',
        partnerConnected: players.length >= 2,
        players: players || []
      });
    }

    // Get all players
    const players = await kv.lrange(`room:${room}:players`, 0, -1);
    const partnerConnected = players.length >= 2;

    // Get partner name
    const partnerId = players.find(id => id !== playerId);
    let partnerName = null;
    if (partnerId) {
      partnerName = await kv.get(`player:${partnerId}:name`);
    }

    // Get answers for current card
    const day = gameState.currentDay;
    const card = gameState.currentCard;
    const answersKey = `room:${room}:day:${day}:card:${card}:answers`;
    const answers = await kv.hgetall(answersKey) || {};

    // Parse answers
    const parsedAnswers = {};
    for (const [key, value] of Object.entries(answers)) {
      try {
        parsedAnswers[key] = JSON.parse(value);
      } catch {
        parsedAnswers[key] = value;
      }
    }

    // Check if all players have answered (for the frontend to know)
    let allAnswered = false;
    if (gameState.phase === 'reveal') {
      allAnswered = true;
    } else if (players.length > 0) {
      let answeredCount = 0;
      for (const player of players) {
        if (answers[player]) answeredCount++;
      }
      allAnswered = answeredCount === players.length;
    }

    res.status(200).json({
      phase: gameState.phase || 'playing',
      currentDay: gameState.currentDay || 0,
      currentCard: gameState.currentCard || 0,
      partnerConnected,
      partnerName,
      answers: parsedAnswers,
      allAnswered,
      players: players,
      playerId: playerId
    });

  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
}