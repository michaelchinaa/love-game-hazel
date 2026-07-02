const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const games = {};

// ============================================
// READ QUESTIONS FROM questions.txt
// ============================================
function loadQuestions() {
 const filePath = path.join(__dirname, 'data/questions.txt');

 if (!fs.existsSync(filePath)) {
  console.error('ERROR: questions.txt not found!');
  console.error('Create a questions.txt file in:', __dirname);
  process.exit(1);
 }

 const data = fs.readFileSync(filePath, 'utf8');
 const lines = data.split('\n').filter(line => line.trim() !== '');

 const result = {
  title: '',
  sacredRules: '',
  days: []
 };

 let currentDay = null;

 lines.forEach((line, index) => {
  const parts = line.split('::');
  const type = parts[0];

  try {
   if (type === 'GAME_TITLE') {
    result.title = parts[1];
   }
   else if (type === 'SACRED_RULES') {
    result.sacredRules = parts[1];
   }
   else if (type === 'DAY') {
    currentDay = {
     dayNumber: parseInt(parts[1]),
     title: parts[2],
     deckLabel: parts[3],
     setting: parts[4],
     cards: []
    };
    result.days.push(currentDay);
   }
   else if (type === 'CARD') {
    const card = {
     cardNumber: parseInt(parts[1]),
     title: parts[2],
     question: parts[3],
     options: {}
    };

    // Parse options A-E
    for (let i = 4; i < parts.length; i++) {
     const match = parts[i].match(/^([A-E])\)\s(.+)$/);
     if (match) {
      card.options[match[1]] = match[2];
     }
    }

    if (currentDay) {
     currentDay.cards.push(card);
    }
    changeBackground('rules');
   }
  } catch (err) {
   console.error(`Error parsing line ${index + 1}:`, line.substring(0, 50) + '...');
   console.error(err.message);
  }
 });

 // Validate
 console.log('\n✅ Questions loaded from questions.txt');
 console.log(`   ${result.days.length} days found:`);
 result.days.forEach(day => {
  console.log(`   Day ${day.dayNumber}: ${day.title} - ${day.cards.length} cards`);
 });
 console.log('');

 return result;
}

const questions = loadQuestions();


// ============================================
// SERVER FUNCTIONS
// ============================================

function sendJSON(res, data, status = 200) {
 res.writeHead(status, {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
 });
 res.end(JSON.stringify(data));
}

function parseBody(req) {
 return new Promise((resolve) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
   try { resolve(JSON.parse(body)); }
   catch { resolve({}); }
  });
 });
}

const server = http.createServer(async (req, res) => {
 const url = new URL(req.url, `http://localhost:${PORT}`);
 const pathname = url.pathname;

 if (req.method === 'OPTIONS') {
  res.writeHead(204, {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
   'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
  return;
 }

 // ========== API ROUTES ==========

 // Serve questions as JSON
 if (pathname === '/questions.json') {
  sendJSON(res, questions);
  return;
 }

 // Create game
 if (pathname === '/api/create-game' && req.method === 'POST') {
  const body = await parseBody(req);
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  games[roomCode] = {
   roomCode,
   player1: { id: body.playerId, name: body.playerName || 'Player 1' },
   player2: null,
   currentDay: 0,
   currentCard: 0,
   phase: 'waiting',
   answers: {},
   readyCount: 0,
   nextCount: 0,
   createdAt: Date.now()
  };

  console.log(`Game created: ${roomCode} | Player 1: ${body.playerId}`);
  sendJSON(res, { success: true, roomCode });
  return;
 }

 // Join game
 if (pathname === '/api/join-game' && req.method === 'POST') {
  const body = await parseBody(req);
  const game = games[body.roomCode];

  if (!game) { sendJSON(res, { error: 'Room not found' }, 404); return; }
  if (game.player2) { sendJSON(res, { error: 'Room is full' }, 400); return; }

  game.player2 = { id: body.playerId, name: body.playerName || 'Player 2' };
  game.phase = 'rules';

  console.log(`Player 2 joined: ${body.roomCode} | ${body.playerId}`);
  sendJSON(res, { success: true });
  return;
 }

 // Get game state (polling)
 if (pathname === '/api/game-state' && req.method === 'GET') {
  const room = url.searchParams.get('room');
  const playerId = url.searchParams.get('playerId');
  const game = games[room];

  if (!game) { sendJSON(res, { phase: 'error' }, 404); return; }

  const cardKey = `${game.currentDay}-${game.currentCard}`;
  const answers = game.answers[cardKey] || {};

  sendJSON(res, {
   phase: game.phase,
   currentDay: game.currentDay,
   currentCard: game.currentCard,
   partnerConnected: playerId === game.player1?.id ? !!game.player2 : !!game.player1,
   answers: answers
  });
  return;
 }

 // Player ready
 if (pathname === '/api/ready' && req.method === 'POST') {
  const body = await parseBody(req);
  const game = games[body.roomCode];
  if (!game) { sendJSON(res, { error: 'Game not found' }, 404); return; }

  game.readyCount++;
  console.log(`Ready: ${game.readyCount}/2`);

  if (game.readyCount >= 2) {
   game.phase = 'playing';
   game.readyCount = 0;
   console.log('>>> GAME STARTING');
  }

  sendJSON(res, { success: true });
  return;
 }

 // Submit answer
 if (pathname === '/api/submit-answer' && req.method === 'POST') {
  const body = await parseBody(req);
  const game = games[body.roomCode];
  if (!game) { sendJSON(res, { error: 'Game not found' }, 404); return; }

  const cardKey = `${game.currentDay}-${game.currentCard}`;
  if (!game.answers[cardKey]) {
   game.answers[cardKey] = {};
  }

  game.answers[cardKey][body.playerId] = {
   choice: body.choice,
   customText: body.customText || null,
   time: new Date().toISOString()
  };

  const answerCount = Object.keys(game.answers[cardKey]).length;
  console.log(`Answer: ${cardKey} | Player: ${body.playerId} | Choice: ${body.choice} | Total: ${answerCount}/2`);

  // After both players answer, save the result with full details
  if (answerCount >= 2) {
   game.phase = 'reveal';
   console.log('>>> BOTH ANSWERED - Phase: reveal');

   // Save this card's result with full question and answer text
   saveCardResult(game, cardKey);
  }

  sendJSON(res, { success: true });
  return;
 }

 // Next card
 if (pathname === '/api/next-card' && req.method === 'POST') {
  const body = await parseBody(req);
  const game = games[body.roomCode];
  if (!game) { sendJSON(res, { error: 'Game not found' }, 404); return; }

  game.nextCount++;
  console.log(`Next: ${game.nextCount}/2`);

  if (game.nextCount >= 2) {
   game.nextCount = 0;

   const day = questions.days[game.currentDay];
   if (day) {
    game.currentCard++;
    if (game.currentCard >= day.cards.length) {
     game.currentDay++;
     game.currentCard = 0;
    }
   }

   if (game.currentDay >= questions.days.length) {
    game.phase = 'complete';
    game.completedAt = new Date().toISOString();
    console.log('>>> GAME COMPLETE');
    saveGameComplete(game);
   } else {
    // IMPORTANT: Set phase back to playing for the next card
    game.phase = 'playing';
    console.log(`>>> NEXT CARD: Day ${game.currentDay + 1}, Card ${game.currentCard + 1}`);
   }
  }

  sendJSON(res, { success: true });
  return;
 }

 // ========== STATIC FILES ==========
 const filePath = pathname === '/' ? '/index.html' : pathname;
 const fullPath = path.join(__dirname, 'public', filePath);

 fs.readFile(fullPath, (err, data) => {
  if (err) {
   fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, data2) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data2 || 'Not Found');
   });
  } else {
   const ext = path.extname(fullPath);
   const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
   res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
   res.end(data);
  }
 });
});
// Save a single card result with full details
function saveCardResult(game, cardKey) {
 try {
  const [dayIndex, cardIndex] = cardKey.split('-').map(Number);
  const day = questions.days[dayIndex];
  if (!day) return;

  const card = day.cards[cardIndex];
  if (!card) return;

  const answers = game.answers[cardKey];
  if (!answers) return;

  const player1Id = game.player1?.id;
  const player2Id = game.player2?.id;

  const result = {
   roomCode: game.roomCode,
   dayNumber: day.dayNumber,
   dayTitle: day.title,
   deckLabel: day.deckLabel,
   cardNumber: card.cardNumber,
   cardTitle: card.title,
   question: card.question,
   options: card.options,
   player1: null,
   player2: null,
   answeredAt: new Date().toISOString()
  };

  // Player 1's answer
  if (player1Id && answers[player1Id]) {
   const answer = answers[player1Id];
   result.player1 = {
    name: game.player1.name,
    choice: answer.choice,
    choiceText: answer.choice === 'E' ? 'Other (Custom)' : (card.options[answer.choice] || 'Unknown'),
    customText: answer.customText || null
   };
  }

  // Player 2's answer
  if (player2Id && answers[player2Id]) {
   const answer = answers[player2Id];
   result.player2 = {
    name: game.player2.name,
    choice: answer.choice,
    choiceText: answer.choice === 'E' ? 'Other (Custom)' : (card.options[answer.choice] || 'Unknown'),
    customText: answer.customText || null
   };
  }

  // Read existing results
  const resultsFile = path.join(__dirname, 'results.json');
  let allResults = [];

  if (fs.existsSync(resultsFile)) {
   try {
    const raw = fs.readFileSync(resultsFile, 'utf8');
    allResults = JSON.parse(raw);
    if (!Array.isArray(allResults)) {
     allResults = allResults.games || [];
    }
   } catch (e) {
    allResults = [];
   }
  }

  // Check if this card already has a result (update it)
  const existingIndex = allResults.findIndex(r =>
   r.roomCode === game.roomCode &&
   r.dayNumber === result.dayNumber &&
   r.cardNumber === result.cardNumber
  );

  if (existingIndex >= 0) {
   allResults[existingIndex] = result;
  } else {
   allResults.push(result);
  }

  // Sort by room code, day, card
  allResults.sort((a, b) => {
   if (a.roomCode !== b.roomCode) return a.roomCode.localeCompare(b.roomCode);
   if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
   return a.cardNumber - b.cardNumber;
  });

  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2), 'utf8');
  console.log('📝 Result saved:', result.dayTitle, '-', result.cardTitle);

 } catch (err) {
  console.error('Error saving result:', err.message);
 }
}

// Save complete game summary when game ends
function saveGameComplete(game) {
 try {
  const resultsFile = path.join(__dirname, 'results.json');
  let allResults = [];

  if (fs.existsSync(resultsFile)) {
   try {
    const raw = fs.readFileSync(resultsFile, 'utf8');
    allResults = JSON.parse(raw);
    if (!Array.isArray(allResults)) {
     allResults = allResults.games || [];
    }
   } catch (e) {
    allResults = [];
   }
  }

  // Add game summary at the top
  const summary = {
   type: 'GAME_SUMMARY',
   roomCode: game.roomCode,
   player1: game.player1?.name || 'Unknown',
   player2: game.player2?.name || 'Unknown',
   startedAt: new Date(game.createdAt).toISOString(),
   completedAt: new Date().toISOString(),
   totalCardsAnswered: Object.keys(game.answers).length,
   daysCompleted: game.currentDay
  };

  allResults.push(summary);

  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2), 'utf8');
  console.log('📝 Game summary saved');

 } catch (err) {
  console.error('Error saving game summary:', err.message);
 }
}

server.listen(PORT, () => {
 console.log('\n========================================');
 console.log('  🃏  Card Game Server');
 console.log('========================================');
 console.log(`  Open: http://localhost:${PORT}`);
 console.log('  Open TWO browser tabs to play');
 console.log('  Edit questions.txt to change cards');
 console.log('========================================\n');
});