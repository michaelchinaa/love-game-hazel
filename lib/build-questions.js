const fs = require('fs');
const path = require('path');

// Read questions.txt and convert to JSON
function buildQuestions() {
  const questionsFile = path.join(__dirname, '..', 'data/questions.txt');

  if (!fs.existsSync(questionsFile)) {
    console.error('questions.txt not found!');
    process.exit(1);
  }

  const data = fs.readFileSync(questionsFile, 'utf8');
  const lines = data.split('\n').filter(line => line.trim());

  const result = { title: '', sacredRules: '', days: [] };
  let currentDay = null;

  lines.forEach(line => {
    const parts = line.split('::');

    if (parts[0] === 'GAME_TITLE') result.title = parts[1];
    else if (parts[0] === 'SACRED_RULES') result.sacredRules = parts[1];
    else if (parts[0] === 'DAY') {
      currentDay = {
        dayNumber: parseInt(parts[1]),
        title: parts[2],
        deckLabel: parts[3],
        setting: parts[4],
        cards: []
      };
      result.days.push(currentDay);
    }
    else if (parts[0] === 'CARD') {
      const card = {
        cardNumber: parseInt(parts[1]),
        title: parts[2],
        question: parts[3],
        options: {}
      };
      for (let i = 4; i < parts.length; i++) {
        const match = parts[i].match(/^([A-D])\)\s(.+)$/);
        if (match) card.options[match[1]] = match[2];
      }
      currentDay.cards.push(card);
    }
  });

  const outputPath = path.join(__dirname, '..', 'public', 'questions.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`✅ Built questions.json: ${result.days.length} days`);
  result.days.forEach(d => {
    console.log(`   Day ${d.dayNumber}: ${d.title} - ${d.cards.length} cards`);
  });
}

buildQuestions();