const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ IN-MEMORY STORAGE ============
const db = {
 games: {},        // Stores active game states
 players: {},      // Stores players in each room
 names: {},        // Stores player names
 answers: {},      // Stores answers for each card
 results: {},      // Stores the actual result data for each room
 allResults: []    // Stores a list of room codes that have results
};

// Helper functions
function getGame(roomCode) {
 return db.games[roomCode] || null;
}

function setGame(roomCode, data) {
 db.games[roomCode] = data;
}

function getPlayers(roomCode) {
 return db.players[roomCode] || [];
}

function addPlayer(roomCode, playerId) {
 if (!db.players[roomCode]) {
  db.players[roomCode] = [];
 }
 if (!db.players[roomCode].includes(playerId)) {
  db.players[roomCode].push(playerId);
 }
 return db.players[roomCode];
}

function getPlayerName(playerId) {
 return db.names[playerId] || 'Player';
}

function setPlayerName(playerId, name) {
 db.names[playerId] = name;
}

function getAnswers(roomCode, day, card) {
 const key = `room:${roomCode}:day:${day}:card:${card}:answers`;
 return db.answers[key] || {};
}

function setAnswer(roomCode, day, card, playerId, data) {
 const key = `room:${roomCode}:day:${day}:card:${card}:answers`;
 if (!db.answers[key]) {
  db.answers[key] = {};
 }
 db.answers[key][playerId] = JSON.stringify(data);
 return db.answers[key];
}

function saveResult(roomCode, data) {
 db.results[roomCode] = data;
 if (!db.allResults.includes(roomCode)) {
  db.allResults.push(roomCode);
 }
}

function getResult(roomCode) {
 return db.results[roomCode] || null;
}

function getAllResults() {
 return db.allResults.map(code => db.results[code]).filter(Boolean);
}

// ============ SERVE STATIC FILES ============
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/results.html', (req, res) => {
 res.sendFile(path.join(__dirname, 'results.html'));
});

app.get('/questions.json', (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'questions.json'));
});

// Serve static assets from public/assets
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ============ API ROUTES ============

// POST: /api/create-game - Create a new game
app.post('/api/create-game', (req, res) => {
 try {
  const { roomCode, playerId, playerName } = req.body;

  console.log('📥 Create game request:', { roomCode, playerId, playerName });

  if (!roomCode) {
   return res.status(400).json({
    error: 'Missing roomCode',
    message: 'Room code is required'
   });
  }

  if (!playerId) {
   return res.status(400).json({
    error: 'Missing playerId',
    message: 'Player ID is required'
   });
  }

  let game = getGame(roomCode);
  if (game) {
   return res.json({
    success: true,
    exists: true,
    message: 'Game already exists'
   });
  }

  game = {
   phase: 'waiting',
   currentDay: 0,
   currentCard: 0,
   createdAt: Date.now(),
   players: [playerId]
  };
  setGame(roomCode, game);

  setPlayerName(playerId, playerName || 'Player');
  addPlayer(roomCode, playerId);

  console.log(`✅ Game created successfully in room: ${roomCode}`);

  res.json({
   success: true,
   created: true,
   roomCode: roomCode,
   message: 'Game created successfully'
  });

 } catch (error) {
  console.error('Error in /api/create-game:', error);
  res.status(500).json({
   error: 'Failed to create game',
   details: error.message
  });
 }
});

// POST: /api/join-room - Join an existing room
app.post('/api/join-room', (req, res) => {
 try {
  const { roomCode, playerId, playerName } = req.body;

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  console.log(`📝 ${playerName || 'Player'} (${playerId}) joining room ${roomCode}`);

  let game = getGame(roomCode);
  if (!game) {
   return res.status(404).json({ error: 'Room not found' });
  }

  setPlayerName(playerId, playerName || 'Player');
  const players = addPlayer(roomCode, playerId);
  console.log(`👥 Players in ${roomCode}:`, players);

  game.players = players;
  const isReady = players.length >= 2;
  if (isReady && game.phase === 'waiting') {
   game.phase = 'playing';
   setGame(roomCode, game);
   console.log(`🎮 Game starting in ${roomCode}!`);
  }

  res.json({
   success: true,
   phase: game.phase,
   players: players,
   isReady: isReady,
   message: isReady ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error in /api/join-room:', error);
  res.status(500).json({ error: 'Failed to join room' });
 }
});

// POST: /api/ready - Mark player as ready
app.post('/api/ready', (req, res) => {
 try {
  const { roomCode, playerId, playerName } = req.body;

  if (!roomCode || !playerId) {
   return res.status(400).json({ error: 'Missing roomCode or playerId' });
  }

  console.log(`📝 ${playerName || 'Player'} (${playerId}) ready in room ${roomCode}`);

  setPlayerName(playerId, playerName || 'Player');

  let game = getGame(roomCode);
  if (!game) {
   game = {
    phase: 'waiting',
    currentDay: 0,
    currentCard: 0,
    createdAt: Date.now()
   };
   setGame(roomCode, game);
  }

  const players = addPlayer(roomCode, playerId);
  console.log(`👥 Players in ${roomCode}:`, players);

  const isReady = players.length >= 2;
  if (isReady && game.phase === 'waiting') {
   game.phase = 'playing';
   setGame(roomCode, game);
   console.log(`🎮 Game starting in ${roomCode}!`);
  }

  res.json({
   success: true,
   phase: game.phase,
   players: players,
   isReady: isReady,
   message: isReady ? 'Game ready to start!' : 'Waiting for partner...'
  });

 } catch (error) {
  console.error('Error in /api/ready:', error);
  res.status(500).json({ error: 'Failed to mark ready' });
 }
});

// GET: /api/game-state - Get current game state
app.get('/api/game-state', (req, res) => {
 try {
  const { room, playerId } = req.query;

  if (!room || !playerId) {
   return res.status(400).json({ error: 'Missing room or playerId' });
  }

  const game = getGame(room);
  if (!game) {
   return res.json({
    phase: 'not_found',
    error: 'Room not found'
   });
  }

  const players = getPlayers(room);
  const partnerId = players.find(id => id !== playerId);
  const partnerConnected = !!partnerId;
  const partnerName = partnerId ? getPlayerName(partnerId) : null;

  const day = game.currentDay || 0;
  const card = game.currentCard || 0;
  const answers = getAnswers(room, day, card);

  const parsedAnswers = {};
  let allAnswered = false;
  for (const [key, value] of Object.entries(answers)) {
   try {
    parsedAnswers[key] = JSON.parse(value);
   } catch {
    parsedAnswers[key] = value;
   }
  }

  if (players.length > 0) {
   let answeredCount = 0;
   for (const p of players) {
    if (parsedAnswers[p]) answeredCount++;
   }
   allAnswered = answeredCount === players.length && players.length > 0;
  }

  if (game.phase === 'playing' && allAnswered) {
   game.phase = 'reveal';
   setGame(room, game);
  }

  res.json({
   phase: game.phase || 'waiting',
   currentDay: game.currentDay || 0,
   currentCard: game.currentCard || 0,
   players: players,
   partnerConnected: partnerConnected,
   partnerName: partnerName,
   answers: parsedAnswers,
   allAnswered: allAnswered,
   isComplete: game.phase === 'complete',
   playerId: playerId,
   totalCards: getTotalCardsForDay(day) // Get dynamic card count
  });

 } catch (error) {
  console.error('Error in /api/game-state:', error);
  res.status(500).json({ error: 'Failed to get game state' });
 }
});

// Helper: Get total cards for a specific day from questions.json
function getTotalCardsForDay(dayIndex) {
 try {
  const questionsPath = path.join(__dirname, 'public', 'questions.json');
  if (fs.existsSync(questionsPath)) {
   const data = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
   if (data.days && data.days[dayIndex]) {
    return data.days[dayIndex].cards.length;
   }
  }
 } catch (error) {
  console.error('Error reading questions.json:', error);
 }
 return 5; // Default fallback
}

// POST: /api/submit-answer - Submit an answer
app.post('/api/submit-answer', (req, res) => {
 try {
  const { roomCode, playerId, choice, customText } = req.body;

  if (!roomCode || !playerId || !choice) {
   return res.status(400).json({ error: 'Missing required fields' });
  }

  const game = getGame(roomCode);
  if (!game) {
   return res.status(404).json({ error: 'Game not found' });
  }

  if (game.phase !== 'playing') {
   return res.status(400).json({ error: 'Game is not in playing phase' });
  }

  const day = game.currentDay || 0;
  const card = game.currentCard || 0;

  const answerData = {
   choice,
   customText,
   timestamp: Date.now(),
   playerId
  };
  setAnswer(roomCode, day, card, playerId, answerData);

  const players = getPlayers(roomCode);
  const answers = getAnswers(roomCode, day, card);

  let answeredCount = 0;
  for (const p of players) {
   if (answers[p]) answeredCount++;
  }
  const allAnswered = answeredCount === players.length && players.length > 0;

  if (allAnswered && players.length >= 2) {
   game.phase = 'reveal';
   setGame(roomCode, game);
  }

  res.json({
   success: true,
   allAnswered,
   totalPlayers: players.length,
   answeredCount: answeredCount,
   phase: game.phase,
   message: allAnswered ? 'All players have answered!' : `Waiting for partner... (${answeredCount}/${players.length})`
  });

 } catch (error) {
  console.error('Error in /api/submit-answer:', error);
  res.status(500).json({ error: 'Failed to submit answer' });
 }
});

// POST: /api/next-card - Move to next card
app.post('/api/next-card', (req, res) => {
 try {
  const { roomCode, playerId } = req.body;

  if (!roomCode) {
   return res.status(400).json({ error: 'Missing roomCode' });
  }

  const game = getGame(roomCode);
  if (!game) {
   return res.status(404).json({ error: 'Game not found' });
  }

  // Move to next card
  game.phase = 'playing';
  game.currentCard = (game.currentCard || 0) + 1;

  // Get total cards for this day from questions.json
  const totalCards = getTotalCardsForDay(game.currentDay);

  console.log(`📄 Day ${game.currentDay + 1}, Card ${game.currentCard + 1}/${totalCards}`);

  // Check if we've completed all cards for this day
  if (game.currentCard >= totalCards) {
   game.currentCard = 0;
   game.currentDay = (game.currentDay || 0) + 1;

   console.log(`📆 Moving to Day ${game.currentDay + 1}`);

   // Check if game is complete (5 days)
   if (game.currentDay >= 5) {
    game.phase = 'complete';
    setGame(roomCode, game);
    console.log(`🏁 Game complete in room ${roomCode}!`);
    return res.json({
     success: true,
     phase: 'complete',
     message: 'Game complete!'
    });
   }
  }

  setGame(roomCode, game);

  res.json({
   success: true,
   currentDay: game.currentDay,
   currentCard: game.currentCard,
   phase: game.phase
  });

 } catch (error) {
  console.error('Error in /api/next-card:', error);
  res.status(500).json({ error: 'Failed to advance to next card' });
 }
});

// POST: /api/save-results - Save game results
app.post('/api/save-results', (req, res) => {
 try {
  const { roomCode, results } = req.body;

  if (!roomCode || !results) {
   return res.status(400).json({ error: 'Missing roomCode or results' });
  }

  console.log(`💾 Saving results for room ${roomCode}`);

  saveResult(roomCode, {
   ...results,
   savedAt: new Date().toISOString()
  });

  delete db.games[roomCode];
  delete db.players[roomCode];

  res.json({
   success: true,
   message: 'Results saved successfully'
  });

 } catch (error) {
  console.error('Error in /api/save-results:', error);
  res.status(500).json({ error: 'Failed to save results' });
 }
});

// GET: /api/get-results - Get results
app.get('/api/get-results', (req, res) => {
 try {
  const { roomCode } = req.query;
  let results = [];

  if (roomCode) {
   const result = getResult(roomCode);
   if (result) results = [result];
  } else {
   results = getAllResults();
  }

  res.json({
   success: true,
   results,
   total: results.length
  });

 } catch (error) {
  console.error('Error in /api/get-results:', error);
  res.status(500).json({ error: 'Failed to get results' });
 }
});

// ============ START SERVER ============
app.listen(PORT, () => {
 console.log(`\n🚀 Server running at http://localhost:${PORT}`);
 console.log(`📊 Results page: http://localhost:${PORT}/results.html`);
 console.log(`🎮 Game page: http://localhost:${PORT}/`);
 console.log('\n💡 To test multiplayer:');
 console.log('   1. Open two browser windows');
 console.log('   2. Enter the SAME room code in both');
 console.log('   3. Both players should connect\n');
});