# 📔 Journal App - Project Progress

A self-hosted, encrypted journaling application for personal reflection and goal tracking. Built with privacy and simplicity in mind.

## ✨ Features

- **🔐 Encrypted Storage**: All journal data is encrypted using AES-256-GCM with Argon2id key derivation
- **📅 Day-Based Organization**: Navigate through your journal entries by date with an intuitive calendar interface
- **🪟 Floating Windows**: Flexible content organization with draggable, resizable windows for different content types
- **✍️ Multiple Content Types**: Support for text notes, images (planned), whiteboards (planned), tables (planned), and more
- **🎯 Persistent Goals**: Set daily goals that automatically carry forward to the next day
- **💡 Journal Prompts**: Built-in prompts to help guide your journaling practice
- **🗄️ Multiple Journals**: Create and manage multiple separate journals, each with its own encryption
- **💾 Auto-Save**: Automatic saving every 30 seconds while your vault is unlocked
- **🏠 Self-Hosted**: Complete control over your data - runs entirely on your local machine

## 🛠️ Tech Stack

### Backend

- **Node.js** with Express for the API server
- **SQLite** with SQLCipher for encrypted database storage
- **Argon2** for secure password hashing
- **better-sqlite3-multiple-ciphers** for database encryption

### Frontend

- **Vanilla JavaScript** (no frameworks)
- **HTML/CSS** for UI
- **Interact.js** for drag-and-drop functionality
- **http-server** for local development

## 📋 Prerequisites

- **Node.js** (v16 or higher recommended)
- **npm** (comes with Node.js)

## 🚀 Getting Started

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd journal-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   cd ..
   ```

### Running the Application

The application consists of two parts that need to run simultaneously:

1. **Start the backend server** (in one terminal):

   ```bash
   npm run dev:backend
   ```

   The backend will run on `http://localhost:3000`

2. **Start the frontend server** (in another terminal):

   ```bash
   npm run dev:frontend
   ```

   The frontend will run on `http://localhost:8080`

3. **Open your browser** and navigate to:
   ```
   http://localhost:8080
   ```

### First Time Setup

1. On the unlock screen, click **"Create New Journal"**
2. Enter a journal name (e.g., "my-journal")
3. Choose a strong passphrase (this encrypts your entire journal)
4. Confirm your passphrase
5. Your encrypted journal is now created and ready to use!

## 📖 Usage

### Creating Journal Entries

- Use the **date selector** to navigate between days
- Click **"+ Prompt"** to add a journal prompt window
- Click **"+ Text"** to add a freeform text window
- Drag windows around and resize them as needed
- All changes are auto-saved every 30 seconds

### Managing Goals

- Click **"Edit Goals"** to set your daily goals
- Goals automatically carry forward to the next day
- Edit them daily to track your progress

### Locking Your Vault

- Click **"🔒 Lock"** to encrypt and close your journal
- You'll need to enter your passphrase again to unlock it

### Multiple Journals

You can create multiple journals for different purposes (personal, work, etc.):

1. Lock your current journal
2. Click **"Create New Journal"** on the unlock screen
3. Each journal has its own passphrase and is completely separate

## 🔒 Security Features

- **Encryption at Rest**: All journal data is encrypted using SQLCipher with AES-256-GCM
- **Key Derivation**: Passphrases are hashed with Argon2id (64 MiB memory cost, 3 iterations)
- **No Cloud**: Everything runs locally on your machine
- **Secure Storage**: Database files are stored with 600 permissions in `~/.journal/`
- **Session-Based**: Journals are only accessible while unlocked in your session

### Important Security Notes

- **Remember your passphrase!** There is no password recovery mechanism
- Your passphrase encrypts your entire journal database
- Keep your `~/.journal/` directory backed up (but keep backups secure!)

## 📁 Data Storage

By default, journals are stored in:

```
~/.journal/
```

You can customize this location by setting the `JOURNAL_DIR` environment variable:

```bash
export JOURNAL_DIR=/path/to/your/journals
```

## 🧪 Development

### Code Formatting & Linting

```bash
# Format all code
npm run format

# Check formatting
npm run check:format

# Run linter
npm run lint
```

### Project Structure

```
journal-app/
├── backend/           # Express API server
│   ├── server.js      # Main server file
│   ├── db.js          # Database connection & encryption
│   └── db-bootstrap.js # Database initialization
├── frontend/          # Vanilla JS client
│   ├── index.html     # Main HTML file
│   ├── css/          # Stylesheets
│   └── js/           # JavaScript modules
└── package.json      # Workspace configuration
```

### Database Schema

The app uses an encrypted SQLite database with the following main tables:

- `days` - Date-based entries
- `floating_windows` - Content containers
- `window_content` - Text content
- `blobs` - Binary data (images, canvas)
- `persistent_goals` - Daily goals
- `journal_prompts` - Journaling prompts
- `credentials` - Encrypted API keys (future use)

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 or 8080 is already in use:

- **Backend**: Set `PORT` environment variable: `PORT=3001 npm run dev:backend`
- **Frontend**: Edit `frontend/package.json` and change the port in the dev script

### "Cannot find module" Errors

Run `npm install` in the root directory, then in both `frontend/` and `backend/` directories.

### Database Locked/Corrupted

If you see database errors:

1. Make sure only one instance of the backend is running
2. Check for `.tmp` files in your `~/.journal/` directory and remove them
3. Ensure the database file has proper permissions (600)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Acknowledgments

Built with passion for privacy, journaling, and self-improvement.

---

**Note**: This is a personal project for self-hosted use. Always backup your journal data regularly!
