import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { room, playerId } = req.query;

  if (!room || !playerId) {
    return res.status(400).json({ error: 'Missing room or playerId' });
  }

  try {
    // Get game state from KV
    const gameState = await kv.get(`game:${room}`);
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all players in the room
    const players = await kv.lrange(`room:${room}:players`, 0, -1);
    const partnerConnected = players.length >= 2;

    // Get answers for this card
    const answersKey = `room:${room}:day:${gameState.currentDay}:card:${gameState.currentCard}:answers`;
    const answers = await kv.hgetall(answersKey) || {};

    // Get partner name
    const partnerId = players.find(id => id !== playerId);
    const partnerName = partnerId ? await kv.get(`player:${partnerId}:name`) : null;

    res.status(200).json({
      phase: gameState.phase || 'playing',
      currentDay: gameState.currentDay || 0,
      currentCard: gameState.currentCard || 0,
      partnerConnected,
      answers,
      partnerName
    });

  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
}