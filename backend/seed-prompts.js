/* eslint-disable no-console */
// seed-prompts.js
// Populate database with common journal prompts

const crypto = require('crypto');

const JOURNAL_PROMPTS = [
  {
    title: 'Daily Gratitude',
    description: 'What are three things you are grateful for today?',
    category: 'gratitude',
  },
  {
    title: 'Challenges & Growth',
    description: 'What challenged you today and what did you learn from it?',
    category: 'reflection',
  },
  {
    title: 'Daily Learning',
    description: 'What did you learn today? How will you apply it?',
    category: 'learning',
  },
  {
    title: "Tomorrow's Goals",
    description: 'What are your top 3 goals or priorities for tomorrow?',
    category: 'planning',
  },
  {
    title: 'Emotional Check-in',
    description: 'How are you feeling right now? What emotions are present?',
    category: 'emotional',
  },
  {
    title: 'Moments of Joy',
    description: 'What made you smile or laugh today?',
    category: 'gratitude',
  },
  {
    title: 'Self-Improvement',
    description: 'What is one thing you would like to improve about yourself?',
    category: 'growth',
  },
  {
    title: 'Worries & Concerns',
    description: 'What are you worried about? Is there anything you can do about it?',
    category: 'emotional',
  },
  {
    title: 'Accomplishments',
    description: 'What are you proud of today, big or small?',
    category: 'reflection',
  },
  {
    title: 'Relationships',
    description:
      'Who are the important people in your life? How can you strengthen those connections?',
    category: 'relationships',
  },
];

/**
 * Seeds journal prompts into the database
 * @param {Database} db - Database connection
 */
function seedPrompts(db) {
  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO journal_prompts (id, title, description, config) VALUES (?, ?, ?, ?)'
  );

  let count = 0;
  for (const prompt of JOURNAL_PROMPTS) {
    const id = crypto.randomUUID();
    const config = JSON.stringify({
      type: 'text',
      category: prompt.category,
      prefill: `${prompt.description}\n\n`,
    });

    insertStmt.run(id, prompt.title, prompt.description, config);
    count++;
  }

  console.log(`Seeded ${count} journal prompts`);
}

module.exports = { seedPrompts, JOURNAL_PROMPTS };
