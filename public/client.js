// ===== FIREBASE CONFIGURATION =====
// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ===== MUSIC SYSTEM =====
const musicSystem = {
  bgMusic: document.getElementById('bgMusic'),
  musicToggle: document.getElementById('musicToggle'),
  volumeSlider: document.getElementById('volumeSlider'),
  prevTrack: document.getElementById('prevTrack'),
  nextTrack: document.getElementById('nextTrack'),
  trackName: document.getElementById('trackName'),
  isMuted: false,
  currentTrackIndex: 0,

  tracks: [
    { name: 'Lobby Music', file: '/assets/music/lobby.mp3', image: '/assets/images/lobby.jpg' },
    { name: 'Day 1 - The Salsa Bar', file: '/assets/music/day1-salsa.mp3', image: '/assets/images/day1-salsa.jpg', overlay: 'overlay-day1' },
    { name: 'Day 2 - The Spa', file: '/assets/music/day2-spa.mp3', image: '/assets/images/day2-spa.jpg', overlay: 'overlay-day2' },
    { name: 'Day 3 - The Masquerade', file: '/assets/music/day3-masquerade.mp3', image: '/assets/images/day3-masquerade.jpg', overlay: 'overlay-day3' },
    { name: 'Day 4 - The Third Person', file: '/assets/music/day4-intimate.mp3', image: '/assets/images/day4-intimate.jpg', overlay: 'overlay-day4' },
    { name: 'Day 5 - The Final Day', file: '/assets/music/day5-dawn.mp3', image: '/assets/images/day5-dawn.jpg', overlay: 'overlay-day5' }
  ],

  init() {
    // Load saved volume
    const savedVolume = localStorage.getItem('bgMusicVolume');
    if (savedVolume !== null) {
      this.bgMusic.volume = savedVolume / 100;
      this.volumeSlider.value = savedVolume;
    } else {
      this.bgMusic.volume = 0.3;
      this.volumeSlider.value = 30;
    }

    // Load saved mute state
    const savedMute = localStorage.getItem('bgMusicMuted');
    if (savedMute === 'true') {
      this.isMuted = true;
      this.bgMusic.muted = true;
      this.musicToggle.classList.add('muted');
      this.musicToggle.querySelector('.music-icon').textContent = '🔇';
    }

    // Event listeners
    this.musicToggle.addEventListener('click', () => this.toggleMute());
    this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

    if (this.prevTrack) {
      this.prevTrack.addEventListener('click', () => this.changeTrack(-1));
    }
    if (this.nextTrack) {
      this.nextTrack.addEventListener('click', () => this.changeTrack(1));
    }

    // Auto-play on first user interaction
    document.addEventListener('click', () => {
      if (this.bgMusic.paused && !this.isMuted) {
        this.bgMusic.play().catch(() => { });
      }
    }, { once: true });
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.bgMusic.muted = this.isMuted;
    localStorage.setItem('bgMusicMuted', this.isMuted);

    if (this.isMuted) {
      this.musicToggle.classList.add('muted');
      this.musicToggle.querySelector('.music-icon').textContent = '🔇';
    } else {
      this.musicToggle.classList.remove('muted');
      this.musicToggle.querySelector('.music-icon').textContent = '🎵';
      if (this.bgMusic.paused) {
        this.bgMusic.play().catch(() => { });
      }
    }
  },

  setVolume(value) {
    this.bgMusic.volume = value / 100;
    localStorage.setItem('bgMusicVolume', value);
  },

  changeTrack(direction) {
    this.currentTrackIndex += direction;
    if (this.currentTrackIndex < 0) this.currentTrackIndex = this.tracks.length - 1;
    if (this.currentTrackIndex >= this.tracks.length) this.currentTrackIndex = 0;

    this.playTrack(this.currentTrackIndex);
  },

  playTrack(index) {
    const track = this.tracks[index];
    this.currentTrackIndex = index;

    // Fade out current
    this.bgMusic.volume = 0;

    setTimeout(() => {
      this.bgMusic.src = track.file;
      this.bgMusic.load();
      this.bgMusic.play().catch(() => { });
      this.trackName.textContent = track.name;

      // Fade in
      let vol = 0;
      const targetVol = this.volumeSlider.value / 100;
      const fadeInterval = setInterval(() => {
        vol += 0.02;
        if (vol >= targetVol) {
          vol = targetVol;
          clearInterval(fadeInterval);
        }
        this.bgMusic.volume = this.isMuted ? 0 : vol;
      }, 50);

      // Change background image
      if (track.image) {
        changeBackground(track.image, track.overlay);
      }
    }, 300);
  },

  playTrackForDay(dayNumber) {
    const index = dayNumber; // Day 1 = index 1, etc.
    if (index >= 0 && index < this.tracks.length) {
      this.playTrack(index);
    }
  },

  updateTrackName(name) {
    this.trackName.textContent = name;
  }
};

// ===== BACKGROUND SYSTEM =====
function changeBackground(imageSrc, overlayClass) {
  const bgImage = document.getElementById('backgroundImage');
  const overlay = document.querySelector('.background-overlay');

  if (!bgImage) return;

  // Fade out
  bgImage.classList.add('fading');

  // Remove old overlay classes
  overlay.className = 'background-overlay';

  setTimeout(() => {
    bgImage.src = imageSrc;
    bgImage.classList.remove('fading');

    // Add new overlay class
    if (overlayClass) {
      overlay.classList.add(overlayClass);
    }
  }, 500);
}

// ===== GAME STATE =====
let currentState = {
  roomCode: null,
  playerId: generatePlayerId(),
  playerName: null,
  selectedOption: null,
  isCustomAnswer: false,
  partnerHasAnswered: false,
  hasSubmitted: false,
  currentDay: null,
  gameRef: null,
  answersRef: null,
  connected: false
};

function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substring(2, 9);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  musicSystem.init();

  // Check if we're on game page with room code
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode) {
    currentState.roomCode = roomCode;
    currentState.playerName = localStorage.getItem('playerName') || 'Player';
    initializeGameListeners(roomCode);
    updatePartnerStatus(true);
  }
});

// ===== LOBBY LOGIC =====
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const playerNameInput = document.getElementById('playerNameInput');

if (createGameBtn) {
  createGameBtn.addEventListener('click', async () => {
    const roomCode = generateRoomCode();
    currentState.roomCode = roomCode;

    // Save to Firebase
    const gameRef = database.ref(`games/${roomCode}`);
    await gameRef.set({
      roomCode: roomCode,
      gameId: generateGameId(),
      players: {
        [currentState.playerId]: {
          name: 'Player 1',
          connected: true
        }
      },
      currentDayIndex: 0,
      currentCardIndex: 0,
      phase: 'waiting',
      startedAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Listen for player 2 joining
    gameRef.child('players').on('value', (snapshot) => {
      const players = snapshot.val();
      if (players && Object.keys(players).length >= 2) {
        window.location.href = '/game.html?room=' + roomCode;
      }
    });

    showRoomCode(roomCode);
    musicSystem.playTrack(0); // Lobby music
  });
}

if (joinGameBtn) {
  joinGameBtn.addEventListener('click', async () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim();

    if (!roomCode || roomCode.length !== 6) {
      alert('Please enter a valid 6-character room code');
      return;
    }
    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    currentState.roomCode = roomCode;
    currentState.playerName = playerName;
    localStorage.setItem('playerName', playerName);

    // Check if game exists
    const gameSnapshot = await database.ref(`games/${roomCode}`).once('value');
    const game = gameSnapshot.val();

    if (!game) {
      alert('Room not found. Please check the code and try again.');
      return;
    }

    if (game.players && Object.keys(game.players).length >= 2) {
      alert('This room is full.');
      return;
    }

    // Join the game
    await database.ref(`games/${roomCode}/players/${currentState.playerId}`).set({
      name: playerName,
      connected: true
    });

    window.location.href = '/game.html?room=' + roomCode;
  });
}

function showRoomCode(roomCode) {
  document.getElementById('roomCode').textContent = roomCode;
  document.getElementById('roomCodeDisplay').classList.remove('hidden');
  createGameBtn.style.display = 'none';
  document.querySelector('.divider').style.display = 'none';
  document.querySelector('.join-section').style.display = 'none';
}

// ===== GAME LOGIC =====
function initializeGameListeners(roomCode) {
  const gameRef = database.ref(`games/${roomCode}`);
  currentState.gameRef = gameRef;

  // Listen for game state changes
  gameRef.child('phase').on('value', (snapshot) => {
    const phase = snapshot.val();
    handlePhaseChange(phase);
  });

  // Listen for answers
  gameRef.child('answers').on('value', (snapshot) => {
    const answers = snapshot.val();
    if (answers) {
      handleAnswersUpdate(answers);
    }
  });

  // Listen for partner connection
  gameRef.child('players').on('value', (snapshot) => {
    const players = snapshot.val();
    if (players) {
      const playerCount = Object.keys(players).length;
      const partnerConnected = Object.values(players).some(p =>
        p.connected && Object.keys(players).find(id => id !== currentState.playerId && players[id].connected)
      );
      updatePartnerStatus(partnerConnected);
    }
  });

  // Mark as connected
  gameRef.child(`players/${currentState.playerId}/connected`).onDisconnect().set(false);
  gameRef.child(`players/${currentState.playerId}/connected`).set(true);

  // Load questions
  fetch('/questions.json')
    .then(res => res.json())
    .then(questions => {
      currentState.questions = questions;
    });

  // Sacred Rules accept button
  const acceptRulesBtn = document.getElementById('acceptRulesBtn');
  if (acceptRulesBtn) {
    acceptRulesBtn.addEventListener('click', () => {
      document.getElementById('sacredRulesOverlay').classList.add('hidden');
      gameRef.child('readyCount').transaction(count => (count || 0) + 1, (error, committed, snapshot) => {
        if (committed && snapshot.val() >= 2) {
          gameRef.update({
            phase: 'answering',
            readyCount: 0
          });
          sendCurrentCard(gameRef);
        }
      });
    });
  }

  // Submit answer button
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener('click', () => {
      if (currentState.hasSubmitted) return;
      currentState.hasSubmitted = true;

      const answerData = {
        choice: currentState.selectedOption,
        customText: currentState.isCustomAnswer ?
          document.getElementById('customAnswer').value.trim() : null,
        submittedAt: firebase.database.ServerValue.TIMESTAMP
      };

      const cardKey = `${currentState.currentDayIndex || 0}-${currentState.currentCardIndex || 0}`;
      gameRef.child(`answers/${cardKey}/${currentState.playerId}`).set(answerData);

      // Update UI
      submitAnswerBtn.style.display = 'none';
      document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
      document.getElementById('waitingText').classList.remove('hidden');
    });
  }

  // Next card button
  const nextCardBtn = document.getElementById('nextCardBtn');
  if (nextCardBtn) {
    nextCardBtn.addEventListener('click', () => {
      nextCardBtn.disabled = true;
      nextCardBtn.textContent = 'Waiting for partner...';
      gameRef.child('nextReadyCount').transaction(count => (count || 0) + 1, (error, committed, snapshot) => {
        if (committed && snapshot.val() >= 2) {
          advanceToNextCard(gameRef);
        }
      });
    });
  }

  // Option buttons
  document.getElementById('optionsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn || currentState.hasSubmitted) return;

    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const letter = btn.querySelector('.option-letter').textContent;
    currentState.selectedOption = letter;

    if (letter === 'E') {
      document.getElementById('otherInput').classList.remove('hidden');
      currentState.isCustomAnswer = true;
      document.getElementById('customAnswer').focus();
    } else {
      document.getElementById('otherInput').classList.add('hidden');
      currentState.isCustomAnswer = false;
    }

    updateSubmitButton();
  });

  // Custom answer input
  document.getElementById('customAnswer')?.addEventListener('input', updateSubmitButton);
}

function handlePhaseChange(phase) {
  switch (phase) {
    case 'sacredRules':
      showSacredRules();
      break;
    case 'answering':
      // Card is being shown via sendCurrentCard
      break;
    case 'gameComplete':
      showGameComplete();
      break;
  }
}

function showSacredRules() {
  const overlay = document.getElementById('sacredRulesOverlay');
  const rulesText = document.getElementById('sacredRulesText');

  if (overlay && rulesText && currentState.questions) {
    rulesText.textContent = currentState.questions.sacredRules;
    overlay.classList.remove('hidden');
  }
}

function sendCurrentCard(gameRef) {
  gameRef.once('value').then(snapshot => {
    const game = snapshot.val();
    const questions = currentState.questions;
    if (!questions) return;

    const day = questions.days[game.currentDayIndex];
    if (!day) {
      // Game complete
      gameRef.update({ phase: 'gameComplete' });
      return;
    }

    const card = day.cards[game.currentCardIndex];
    if (!card) {
      // Day complete
      gameRef.update({
        currentDayIndex: game.currentDayIndex + 1,
        currentCardIndex: 0
      });
      return;
    }

    currentState.currentDayIndex = game.currentDayIndex;
    currentState.currentCardIndex = game.currentCardIndex;

    // Update music & background
    musicSystem.playTrackForDay(day.dayNumber);

    // Reset card state
    resetCardState();

    // Update header
    document.getElementById('dayLabel').textContent = `Day ${day.dayNumber} - ${day.deckLabel}`;
    document.getElementById('dayTitle').textContent = day.title;
    document.getElementById('cardCounter').textContent = `Card ${card.cardNumber} of ${day.cards.length}`;

    // Show setting on first card
    if (card.cardNumber === 1) {
      document.getElementById('settingText').textContent = day.setting;
      document.getElementById('settingDisplay').classList.remove('hidden');
    } else {
      document.getElementById('settingDisplay').classList.add('hidden');
    }

    // Display card
    document.getElementById('cardTitle').textContent = card.cardTitle;
    document.getElementById('cardQuestion').textContent = card.question;
    document.getElementById('cardDisplay').classList.remove('hidden');

    // Build options
    const optionsGrid = document.getElementById('optionsGrid');
    optionsGrid.innerHTML = '';
    Object.entries(card.options).forEach(([letter, text]) => {
      const button = document.createElement('button');
      button.className = 'option-btn';
      button.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-text">${text}</span>
      `;
      optionsGrid.appendChild(button);
    });

    document.getElementById('optionsContainer').classList.remove('hidden');
    document.getElementById('revealSection').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function handleAnswersUpdate(answers) {
  const cardKey = `${currentState.currentDayIndex}-${currentState.currentCardIndex}`;
  const cardAnswers = answers[cardKey];

  if (!cardAnswers) return;

  const answerCount = Object.keys(cardAnswers).length;

  // Check if partner answered
  const partnerAnswered = Object.keys(cardAnswers).some(id => id !== currentState.playerId);
  if (partnerAnswered && !currentState.partnerHasAnswered) {
    currentState.partnerHasAnswered = true;
    const waitingText = document.getElementById('waitingText');
    if (waitingText && currentState.hasSubmitted) {
      waitingText.innerHTML = '<span>Both answers submitted! Revealing...</span>';
    }
  }

  // Check if both answered
  if (answerCount >= 2) {
    revealAnswers(cardAnswers);
  }
}

function revealAnswers(cardAnswers) {
  const myAnswer = cardAnswers[currentState.playerId];
  const partnerId = Object.keys(cardAnswers).find(id => id !== currentState.playerId);
  const partnerAnswer = partnerId ? cardAnswers[partnerId] : null;

  const card = currentState.questions
    ?.days[currentState.currentDayIndex]
    ?.cards[currentState.currentCardIndex];

  // Display your answer
  document.getElementById('yourChoice').innerHTML = `
    <strong>Choice ${myAnswer.choice}:</strong> 
    ${myAnswer.choice === 'E' ? 'Other (Custom Answer)' : (card?.options[myAnswer.choice] || '')}
  `;

  if (myAnswer.customText) {
    document.getElementById('yourCustom').textContent = `"${myAnswer.customText}"`;
    document.getElementById('yourCustom').classList.remove('hidden');
  }

  // Display partner's answer
  if (partnerAnswer) {
    document.getElementById('partnerChoice').innerHTML = `
      <strong>Choice ${partnerAnswer.choice}:</strong> 
      ${partnerAnswer.choice === 'E' ? 'Other (Custom Answer)' : (card?.options[partnerAnswer.choice] || '')}
    `;

    if (partnerAnswer.customText) {
      document.getElementById('partnerCustom').textContent = `"${partnerAnswer.customText}"`;
      document.getElementById('partnerCustom').classList.remove('hidden');
    }
  }

  // Show reveal section
  document.getElementById('optionsContainer').classList.add('hidden');
  document.getElementById('revealSection').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Save results
  saveResults(cardAnswers, card);
}

async function saveResults(cardAnswers, card) {
  if (!card) return;

  const answerEntry = {
    dayNumber: currentState.questions.days[currentState.currentDayIndex].dayNumber,
    dayTitle: currentState.questions.days[currentState.currentDayIndex].title,
    deckLabel: currentState.questions.days[currentState.currentDayIndex].deckLabel,
    cardNumber: card.cardNumber,
    cardTitle: card.cardTitle,
    question: card.question,
    options: card.options,
    answers: {},
    answeredAt: firebase.database.ServerValue.TIMESTAMP
  };

  Object.entries(cardAnswers).forEach(([playerId, answer]) => {
    answerEntry.answers[playerId] = {
      choice: answer.choice,
      choiceText: answer.choice !== 'E' ? card.options[answer.choice] : 'Other',
      customText: answer.customText || null
    };
  });

  // Save to results in Firebase
  const gameSnapshot = await currentState.gameRef.once('value');
  const game = gameSnapshot.val();

  await database.ref(`results/${game.gameId}/cards`).push(answerEntry);
  await database.ref(`results/${game.gameId}/gameInfo`).set({
    gameId: game.gameId,
    roomCode: game.roomCode,
    players: game.players,
    startedAt: game.startedAt,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP
  });
}

function advanceToNextCard(gameRef) {
  gameRef.update({
    currentCardIndex: firebase.database.ServerValue.increment(1),
    nextReadyCount: 0,
    phase: 'answering'
  }).then(() => {
    sendCurrentCard(gameRef);
  });
}

function showGameComplete() {
  document.getElementById('cardDisplay').classList.add('hidden');
  document.getElementById('optionsContainer').classList.add('hidden');
  document.getElementById('revealSection').classList.add('hidden');
  document.querySelector('.game-header').style.display = 'none';
  document.getElementById('gameComplete').classList.remove('hidden');

  musicSystem.playTrackForDay(5);

  // Mark game as complete
  currentState.gameRef.child('completedAt').set(firebase.database.ServerValue.TIMESTAMP);
}

// ===== UI HELPERS =====
function resetCardState() {
  currentState.selectedOption = null;
  currentState.isCustomAnswer = false;
  currentState.partnerHasAnswered = false;
  currentState.hasSubmitted = false;

  const submitBtn = document.getElementById('submitAnswerBtn');
  const waitingText = document.getElementById('waitingText');
  const otherInput = document.getElementById('otherInput');
  const customAnswer = document.getElementById('customAnswer');
  const nextCardBtn = document.getElementById('nextCardBtn');

  if (submitBtn) {
    submitBtn.style.display = 'block';
    submitBtn.disabled = true;
  }
  if (waitingText) {
    waitingText.classList.add('hidden');
    waitingText.innerHTML = '<span class="waiting-animation">Waiting for your partner to answer</span><span class="dots"></span>';
  }
  if (otherInput) otherInput.classList.add('hidden');
  if (customAnswer) customAnswer.value = '';
  if (nextCardBtn) {
    nextCardBtn.disabled = false;
    nextCardBtn.textContent = 'Next Card →';
  }

  document.getElementById('yourCustom')?.classList.add('hidden');
  document.getElementById('partnerCustom')?.classList.add('hidden');
  document.getElementById('settingDisplay')?.classList.add('hidden');

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('selected');
  });
}

function updateSubmitButton() {
  const submitBtn = document.getElementById('submitAnswerBtn');
  if (!submitBtn) return;

  if (currentState.selectedOption) {
    if (currentState.isCustomAnswer) {
      submitBtn.disabled = !document.getElementById('customAnswer').value.trim();
    } else {
      submitBtn.disabled = false;
    }
  } else {
    submitBtn.disabled = true;
  }
}

function updatePartnerStatus(connected) {
  const dot = document.getElementById('partnerDot');
  const text = document.getElementById('partnerText');
  if (!dot || !text) return;

  if (connected) {
    dot.className = 'dot connected';
    text.textContent = 'Partner Connected';
  } else {
    dot.className = 'dot disconnected';
    text.textContent = 'Waiting for Partner...';
  }
}

// ===== UTILITIES =====
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateGameId() {
  return 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

// Return home button
document.getElementById('returnHomeBtn')?.addEventListener('click', () => {
  window.location.href = '/';
});