/* eslint-disable no-console */
// server.js
// Express server for the journal app backend

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { openDatabase, closeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large blob uploads

// In-memory session store (simple for single-user, replace with proper auth later)
let dbConnection = null;
let isUnlocked = false;

// Utility to generate UUIDs
function generateId() {
  return crypto.randomUUID();
}

// Middleware to check if vault is unlocked
function requireUnlock(req, res, next) {
  if (!isUnlocked || !dbConnection) {
    return res.status(401).json({ error: 'Vault is locked. Unlock first.' });
  }
  next();
}

// === Authentication Routes ===

// POST /api/unlock - Unlock the vault with passphrase
app.post('/api/unlock', async (req, res) => {
  try {
    const { passphrase } = req.body;

    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase required' });
    }

    dbConnection = await openDatabase(passphrase);
    isUnlocked = true;

    res.json({ success: true, message: 'Vault unlocked' });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/lock - Lock the vault
app.post('/api/lock', (req, res) => {
  if (dbConnection) {
    closeDatabase(dbConnection);
    dbConnection = null;
  }
  isUnlocked = false;
  res.json({ success: true, message: 'Vault locked' });
});

// GET /api/status - Check if vault is unlocked
app.get('/api/status', (req, res) => {
  res.json({ unlocked: isUnlocked });
});

// === Day Routes ===

// GET /api/days - Get all days
app.get('/api/days', requireUnlock, (req, res) => {
  try {
    const days = dbConnection.prepare('SELECT * FROM days ORDER BY date DESC').all();
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/days/:date - Get specific day by date (YYYY-MM-DD)
app.get('/api/days/:date', requireUnlock, (req, res) => {
  try {
    const { date } = req.params;
    let day = dbConnection.prepare('SELECT * FROM days WHERE date = ?').get(date);

    // Create day if it doesn't exist
    if (!day) {
      const dayId = generateId();
      const created_at = Date.now();
      dbConnection
        .prepare('INSERT INTO days (id, date, created_at) VALUES (?, ?, ?)')
        .run(dayId, date, created_at);
      day = { id: dayId, date, created_at };

      // Copy forward persistent goals from previous day
      const prevDay = dbConnection
        .prepare('SELECT * FROM days WHERE date < ? ORDER BY date DESC LIMIT 1')
        .get(date);
      if (prevDay) {
        const prevGoal = dbConnection
          .prepare('SELECT * FROM persistent_goals WHERE day_id = ?')
          .get(prevDay.id);
        if (prevGoal) {
          const goalId = generateId();
          dbConnection
            .prepare(
              'INSERT INTO persistent_goals (id, day_id, content, created_at) VALUES (?, ?, ?, ?)'
            )
            .run(goalId, dayId, prevGoal.content, created_at);
        }
      }
    }

    res.json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Persistent Goals Routes ===

// GET /api/days/:dayId/goals - Get persistent goals for a day
app.get('/api/days/:dayId/goals', requireUnlock, (req, res) => {
  try {
    const { dayId } = req.params;
    const goal = dbConnection.prepare('SELECT * FROM persistent_goals WHERE day_id = ?').get(dayId);
    res.json(goal || { content: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/days/:dayId/goals - Update persistent goals for a day
app.put('/api/days/:dayId/goals', requireUnlock, (req, res) => {
  try {
    const { dayId } = req.params;
    const { content } = req.body;

    const existing = dbConnection
      .prepare('SELECT * FROM persistent_goals WHERE day_id = ?')
      .get(dayId);

    if (existing) {
      dbConnection
        .prepare('UPDATE persistent_goals SET content = ?, created_at = ? WHERE day_id = ?')
        .run(content, Date.now(), dayId);
    } else {
      const goalId = generateId();
      dbConnection
        .prepare(
          'INSERT INTO persistent_goals (id, day_id, content, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(goalId, dayId, content, Date.now());
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Floating Windows Routes ===

// GET /api/days/:dayId/windows - Get all windows for a day
app.get('/api/days/:dayId/windows', requireUnlock, (req, res) => {
  try {
    const { dayId } = req.params;
    const windows = dbConnection
      .prepare('SELECT * FROM floating_windows WHERE day_id = ?')
      .all(dayId);

    // Fetch content for each window
    const windowsWithContent = windows.map((window) => {
      const content = dbConnection
        .prepare('SELECT content FROM window_content WHERE window_id = ?')
        .get(window.id);
      return {
        ...window,
        position: JSON.parse(window.position),
        size: JSON.parse(window.size),
        content: content ? content.content : '',
      };
    });

    res.json(windowsWithContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/days/:dayId/windows - Create a new window
app.post('/api/days/:dayId/windows', requireUnlock, (req, res) => {
  try {
    const { dayId } = req.params;
    const { type, position, size, pinned, title, content } = req.body;

    const windowId = generateId();
    const created_at = Date.now();

    dbConnection
      .prepare(
        'INSERT INTO floating_windows (id, day_id, type, position, size, pinned, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        windowId,
        dayId,
        type,
        JSON.stringify(position),
        JSON.stringify(size),
        pinned ? 1 : 0,
        title,
        created_at
      );

    // Create window content if provided
    if (content !== undefined) {
      dbConnection
        .prepare('INSERT INTO window_content (window_id, content, last_modified) VALUES (?, ?, ?)')
        .run(windowId, content, created_at);
    }

    res.json({
      id: windowId,
      day_id: dayId,
      type,
      position,
      size,
      pinned,
      title,
      content: content || '',
      created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/windows/:windowId - Update a window
app.put('/api/windows/:windowId', requireUnlock, (req, res) => {
  try {
    const { windowId } = req.params;
    const { position, size, pinned, title, content } = req.body;

    // Update window metadata
    const updates = [];
    const values = [];

    if (position !== undefined) {
      updates.push('position = ?');
      values.push(JSON.stringify(position));
    }
    if (size !== undefined) {
      updates.push('size = ?');
      values.push(JSON.stringify(size));
    }
    if (pinned !== undefined) {
      updates.push('pinned = ?');
      values.push(pinned ? 1 : 0);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (updates.length > 0) {
      values.push(windowId);
      dbConnection
        .prepare(`UPDATE floating_windows SET ${updates.join(', ')} WHERE id = ?`)
        .run(...values);
    }

    // Update content if provided
    if (content !== undefined) {
      const existing = dbConnection
        .prepare('SELECT * FROM window_content WHERE window_id = ?')
        .get(windowId);
      if (existing) {
        dbConnection
          .prepare('UPDATE window_content SET content = ?, last_modified = ? WHERE window_id = ?')
          .run(content, Date.now(), windowId);
      } else {
        dbConnection
          .prepare(
            'INSERT INTO window_content (window_id, content, last_modified) VALUES (?, ?, ?)'
          )
          .run(windowId, content, Date.now());
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/windows/:windowId - Delete a window
app.delete('/api/windows/:windowId', requireUnlock, (req, res) => {
  try {
    const { windowId } = req.params;

    dbConnection.prepare('DELETE FROM window_content WHERE window_id = ?').run(windowId);
    dbConnection.prepare('DELETE FROM blobs WHERE window_id = ?').run(windowId);
    dbConnection.prepare('DELETE FROM floating_windows WHERE id = ?').run(windowId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Journal Prompts Routes ===

// GET /api/prompts - Get all journal prompts, optionally filter by category
app.get('/api/prompts', requireUnlock, (req, res) => {
  try {
    const { category } = req.query;

    let prompts;
    if (category) {
      // Filter by category (stored in config JSON)
      prompts = dbConnection
        .prepare('SELECT * FROM journal_prompts')
        .all()
        .filter((prompt) => {
          const config = JSON.parse(prompt.config || '{}');
          return config.category === category;
        });
    } else {
      prompts = dbConnection.prepare('SELECT * FROM journal_prompts').all();
    }

    // Parse config for each prompt
    const parsedPrompts = prompts.map((prompt) => ({
      ...prompt,
      config: JSON.parse(prompt.config || '{}'),
    }));

    res.json(parsedPrompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prompts/categories - Get all unique prompt categories
app.get('/api/prompts/categories', requireUnlock, (req, res) => {
  try {
    const prompts = dbConnection.prepare('SELECT config FROM journal_prompts').all();
    const categories = new Set();

    prompts.forEach((prompt) => {
      const config = JSON.parse(prompt.config || '{}');
      if (config.category) {
        categories.add(config.category);
      }
    });

    res.json([...categories].sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Health Check ===
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', unlocked: isUnlocked });
});

// Start server
app.listen(PORT, () => {
  console.log(`Journal backend server running on http://localhost:${PORT}`);
  console.log('Remember to unlock the vault with POST /api/unlock');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  if (dbConnection) {
    closeDatabase(dbConnection);
  }
  process.exit(0);
});
