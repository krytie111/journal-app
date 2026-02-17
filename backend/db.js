// db.js
// Database connection module with encryption support

const fs = require('fs');
const path = require('path');
const os = require('os');
const argon2 = require('argon2');
const Database = require('better-sqlite3-multiple-ciphers');

// Get journal directory from environment variable or use default
const JOURNAL_DIR = process.env.JOURNAL_DIR || path.join(os.homedir(), '.journal');

// Ensure journal directory exists
if (!fs.existsSync(JOURNAL_DIR)) {
  fs.mkdirSync(JOURNAL_DIR, { recursive: true, mode: 0o700 });
}

/**
 * Get the full path for a journal database file
 * @param {string} journalName - Name of the journal (without .db extension)
 * @returns {string} Full path to the database file
 */
function getJournalPath(journalName) {
  // Sanitize journal name to prevent directory traversal
  const safeName = journalName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(JOURNAL_DIR, `${safeName}.db`);
}

/**
 * Derives a 256-bit encryption key from a passphrase using Argon2id
 * @param {string} passphrase - User's master passphrase
 * @param {Buffer} salt - Random salt (16 bytes)
 * @returns {Promise<string>} Hex-encoded key
 */
async function deriveKey(passphrase, salt) {
  const hash = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32, // 256 bits
    salt,
    raw: true,
  });

  return hash.toString('hex');
}

/**
 * Opens and unlocks the encrypted database
 * @param {string} journalName - Name of the journal (without .db extension)
 * @param {string} passphrase - User's master passphrase
 * @returns {Promise<{db: Database, dbPath: string}>} Unlocked database connection and path
 */
async function openDatabase(journalName, passphrase) {
  const dbPath = getJournalPath(journalName);

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Journal "${journalName}" does not exist. Create it first.`);
  }

  // Extract salt from first 16 bytes of database file
  const fileData = fs.readFileSync(dbPath);
  if (fileData.length < 16) {
    throw new Error('Database file is corrupted (too small).');
  }

  const salt = fileData.slice(0, 16);
  const dbData = fileData.slice(16);

  // Write SQLCipher portion to temp file
  const tempDbPath = dbPath + '.tmp';

  // Remove stale temp file if it exists
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }

  fs.writeFileSync(tempDbPath, dbData);
  fs.chmodSync(tempDbPath, 0o600);

  const key = await deriveKey(passphrase, salt);

  const db = new Database(tempDbPath, { readonly: false, fileMustExist: true });

  // Configure SQLCipher encryption
  db.pragma(`key = "x'${key}'"`);
  db.pragma('cipher_page_size = 4096');
  db.pragma('kdf_iter = 256000');
  db.pragma('cipher_hmac_algorithm = HMAC_SHA512');
  db.pragma('cipher_kdf_algorithm = PBKDF2_HMAC_SHA512');

  // Ensure database is writable
  db.pragma('query_only = OFF');

  // Verify the key is correct by attempting a simple query
  try {
    db.pragma('cipher_version');
    // Try to access a table to verify decryption
    db.prepare('SELECT name FROM sqlite_master LIMIT 1').get();
  } catch (err) {
    db.close();
    fs.unlinkSync(tempDbPath);
    throw new Error('Failed to unlock database. Incorrect passphrase?', { cause: err });
  }

  // Using default DELETE journal mode for single-file simplicity
  // No -wal or -shm files = easier backup/export

  return { db, dbPath };
}

/**
 * Safely closes the database connection and updates main file
 * @param {Database} db - Database connection to close
 * @param {string} dbPath - Path to the main database file
 */
function closeDatabase(db, dbPath) {
  if (db) {
    try {
      // Ensure all pending writes are flushed to disk
      // Run a checkpoint (works for any journal mode)
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // Ignore if not in WAL mode
      }

      // Close the database connection
      db.close();

      // Merge temp DB back into main file with salt header
      const tempDbPath = dbPath + '.tmp';
      if (fs.existsSync(tempDbPath)) {
        const dbData = fs.readFileSync(tempDbPath);
        const fileData = fs.readFileSync(dbPath);
        const salt = fileData.slice(0, 16);
        const dbWithHeader = Buffer.concat([salt, dbData]);
        fs.writeFileSync(dbPath, dbWithHeader);
        fs.unlinkSync(tempDbPath);
      }
    } catch (err) {
      console.error('Error closing database:', err);
    }
  }
}

/**
 * List all available journals in the journal directory
 * @returns {string[]} Array of journal names (without .db extension)
 */
function listJournals() {
  if (!fs.existsSync(JOURNAL_DIR)) {
    return [];
  }

  return fs
    .readdirSync(JOURNAL_DIR)
    .filter((file) => file.endsWith('.db'))
    .map((file) => file.slice(0, -3)); // Remove .db extension
}

module.exports = {
  openDatabase,
  closeDatabase,
  getJournalPath,
  listJournals,
  JOURNAL_DIR,
};
