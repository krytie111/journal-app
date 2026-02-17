/* eslint-disable no-console */
// db-bootstrap.js
// Script to create and initialize the encrypted journal database

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argon2 = require('argon2');
const Database = require('better-sqlite3-multiple-ciphers');
const { getJournalPath, JOURNAL_DIR } = require('./db');

// Path to the schema SQL file
const schemaPath = path.resolve(__dirname, '../../journal-app-internal/database-schema.sql');

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
 * Create a new encrypted journal database
 * @param {string} journalName - Name of the journal (without .db extension)
 * @param {string} passphrase - Master passphrase for encryption
 * @returns {Promise<string>} Path to the created database
 */
async function createJournal(journalName, passphrase) {
  const dbPath = getJournalPath(journalName);

  if (fs.existsSync(dbPath)) {
    throw new Error(`Journal "${journalName}" already exists.`);
  }

  // Ensure journal directory exists
  if (!fs.existsSync(JOURNAL_DIR)) {
    fs.mkdirSync(JOURNAL_DIR, { recursive: true, mode: 0o700 });
  }

  console.log(`Creating new encrypted journal: ${journalName}...`);

  // Generate random salt for key derivation
  const salt = crypto.randomBytes(16);
  console.log('Salt generated (will be embedded in database file)');

  // Derive encryption key from passphrase
  const key = await deriveKey(passphrase, salt);
  console.log('Encryption key derived using Argon2id');

  // Create and open the encrypted database
  const db = new Database(dbPath);

  // Configure SQLCipher encryption
  try {
    db.pragma(`key = "x'${key}'"`);
    db.pragma('cipher_page_size = 4096');
    db.pragma('kdf_iter = 256000');
    db.pragma('cipher_hmac_algorithm = HMAC_SHA512');
    db.pragma('cipher_kdf_algorithm = PBKDF2_HMAC_SHA512');

    // Verify encryption is working
    db.pragma('cipher_version');
    console.log('SQLCipher encryption configured');
  } catch (err) {
    console.error('Failed to configure encryption:', err);
    throw err;
  }

  // Read and execute schema
  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    db.exec(schema);
    console.log('Database schema applied.');
  } catch (err) {
    console.error('Failed to apply schema:', err);
    throw err;
  }

  // Seed journal prompts
  const { seedPrompts } = require('./seed-prompts');
  try {
    seedPrompts(db);
  } catch (err) {
    console.error('Failed to seed prompts:', err);
    throw err;
  }

  db.close();

  // Embed salt in database file header
  // Format: [SALT(16 bytes)][SQLCIPHER_DB(rest)]
  const dbData = fs.readFileSync(dbPath);
  const dbWithHeader = Buffer.concat([salt, dbData]);
  fs.writeFileSync(dbPath, dbWithHeader);

  console.log(`✓ Journal "${journalName}" created successfully at: ${dbPath}`);

  return dbPath;
}

/**
 * CLI bootstrap function - kept for backward compatibility
 */
async function bootstrap() {
  const journalName = process.argv[2] || 'my-journal';
  const passphrase = process.argv[3] || 'testpassphrase';

  try {
    await createJournal(journalName, passphrase);
    console.log('Bootstrap complete!');
    process.exit(0);
  } catch (err) {
    console.error('Bootstrap failed:', err.message);
    process.exit(1);
  }
}

// Run bootstrap if called directly from CLI
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  });
}

module.exports = {
  createJournal,
  bootstrap,
};
