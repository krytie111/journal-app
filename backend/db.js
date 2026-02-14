// db.js
// Database connection module with encryption support

const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
const Database = require('better-sqlite3-multiple-ciphers');

const dbPath = path.resolve(__dirname, '../my-journal.db');

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
 * @param {string} passphrase - User's master passphrase
 * @returns {Promise<Database>} Unlocked database connection
 */
async function openDatabase(passphrase) {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file does not exist. Run bootstrap first.');
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

  return db;
}

/**
 * Safely closes the database connection and updates main file
 * @param {Database} db - Database connection to close
 */
function closeDatabase(db) {
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

module.exports = {
  openDatabase,
  closeDatabase,
  dbPath,
};
