// server.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

// --- Server Setup ---
const app = express();
const port = 3001; // Using 3001 to avoid conflicts with frontend dev servers
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for potential large backup imports

// --- Database Connection ---
const db = new Database('webapp.db');
console.log('Database connected.');

// --- Database Initialization ---
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imageUrl TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      correctAnswer TEXT NOT NULL,
      FOREIGN KEY(image_id) REFERENCES training_images(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS training_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      results TEXT NOT NULL,
      totalTime INTEGER NOT NULL,
      totalItems INTEGER NOT NULL,
      correctItems INTEGER NOT NULL,
      accuracy REAL NOT NULL
    );
  `);

  // Seed admin user if it doesn't exist
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!admin) {
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .run('admin', 'admin', 'Admin');
    console.log('Default admin user created.');
  }

  // Seed default training data if none exists
  const hasTrainingData = db.prepare('SELECT id FROM training_images LIMIT 1').get();
  if (!hasTrainingData) {
    console.log('Seeding initial training data...');
    const defaultTrainingData = [
      { id: 1, imageUrl: 'https://i.imgur.com/2G6202K.png', items: [ { prompt: '243,776', correctAnswer: 'PE シヤカイホケンリヨウトウ*' }, { prompt: '121,887', correctAnswer: 'PE シヤカイホケンリヨウトウ*' }, { prompt: '144,450', correctAnswer: 'ジエーシービー' }, { prompt: '11,000', correctAnswer: 'DF. トータルホウシユウ' }, { prompt: '308,000', correctAnswer: '振込 ターボソフト(カ' }, ], },
      { id: 2, imageUrl: 'https://i.imgur.com/Wbixp5F.png', items: [ { prompt: '8,800', correctAnswer: 'ビユーカード' }, { prompt: '5,000', correctAnswer: 'MHF' }, { prompt: '10,000', correctAnswer: 'JCB' }, { prompt: '46,183', correctAnswer: 'アマゾンジャパン' }, { prompt: '7,000', correctAnswer: '77ギンコウ' }, { prompt: '300,000', correctAnswer: 'カ)グッドスピード' }, ], },
      { id: 3, imageUrl: 'https://i.imgur.com/d9j8g1x.png', items: [ { prompt: '660', correctAnswer: 'リソナ' }, { prompt: '20,000', correctAnswer: 'MHF' }, { prompt: '35,000', correctAnswer: 'MHF' }, { prompt: '55,660', correctAnswer: 'AP(ヤフージャパン' }, { prompt: '50,000', correctAnswer: 'NISA' }, ] }
    ];

    const insertImage = db.prepare('INSERT INTO training_images (id, imageUrl) VALUES (?, ?)');
    const insertItem = db.prepare('INSERT INTO training_items (image_id, prompt, correctAnswer) VALUES (?, ?, ?)');

    const seedTransaction = db.transaction((images) => {
      for (const image of images) {
        insertImage.run(image.id, image.imageUrl);
        for (const item of image.items) {
          insertItem.run(image.id, item.prompt, item.correctAnswer);
        }
      }
    });

    seedTransaction(defaultTrainingData);
    console.log('Initial training data seeded.');
  }
  console.log('Database is ready.');
}

initializeDatabase();


// --- Helper Functions ---
const getTrainingData = () => {
    const images = db.prepare('SELECT * FROM training_images').all();
    const items = db.prepare('SELECT * FROM training_items').all();
    return images.map(img => ({
        ...img,
        items: items.filter(item => item.image_id === img.id)
    }));
};


// --- API Endpoints ---

// GET: Initial application data
app.get('/api/data', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role FROM users').all();
    const trainingData = getTrainingData();
    const allAttempts = db.prepare('SELECT * FROM training_attempts').all().map(attempt => ({
        ...attempt,
        results: JSON.parse(attempt.results)
    }));

    res.json({ users, trainingData, allAttempts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: User login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Save/Sync all users
app.post('/api/users', (req, res) => {
    const users = req.body;
    const saveUsers = db.transaction(() => {
        const existingUserIds = new Set(db.prepare('SELECT id FROM users').all().map(u => u.id));
        const payloadUserIds = new Set();

        const updateUser = db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?');
        const updateUserWithPassword = db.prepare('UPDATE users SET username = ?, role = ?, password = ? WHERE id = ?');
        const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');

        for (const user of users) {
            if (user.id) { // Existing user
                payloadUserIds.add(user.id);
                if (user.password) {
                    updateUserWithPassword.run(user.username, user.role, user.password, user.id);
                } else {
                    updateUser.run(user.username, user.role, user.id);
                }
            } else { // New user
                insertUser.run(user.username, user.password, user.role);
            }
        }
        
        // Delete users that were removed on the client
        const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ? AND username != ?');
        existingUserIds.forEach(id => {
            if (!payloadUserIds.has(id)) {
                deleteUserStmt.run(id, 'admin'); // Prevent admin from being deleted
            }
        });
    });

    try {
        saveUsers();
        const updatedUsers = db.prepare('SELECT id, username, role FROM users').all();
        res.status(200).json(updatedUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// POST: Overwrite training data
app.post('/api/training-data', (req, res) => {
  const data = req.body;
  const transaction = db.transaction(() => {
    db.exec('DELETE FROM training_items');
    db.exec('DELETE FROM training_images');
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('training_items', 'training_images')`);
    
    const insertImage = db.prepare('INSERT INTO training_images (id, imageUrl) VALUES (?, ?)');
    const insertItem = db.prepare('INSERT INTO training_items (image_id, prompt, correctAnswer) VALUES (?, ?, ?)');

    for (const image of data) {
      insertImage.run(image.id, image.imageUrl);
      for (const item of image.items) {
        insertItem.run(image.id, item.prompt, item.correctAnswer);
      }
    }
  });

  try {
    transaction();
    res.status(200).json({ message: 'Training data saved successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Save a new training attempt
app.post('/api/attempts', (req, res) => {
    try {
        const { username, timestamp, results, totalTime, totalItems, correctItems, accuracy } = req.body;
        const info = db.prepare(`
            INSERT INTO training_attempts (username, timestamp, results, totalTime, totalItems, correctItems, accuracy) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(username, timestamp, JSON.stringify(results), totalTime, totalItems, correctItems, accuracy);
        
        const newAttempt = { id: info.lastInsertRowid, ...req.body };
        res.status(201).json(newAttempt);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Export all data
app.get('/api/export', (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users').all();
        const trainingData = getTrainingData();
        const attempts = db.prepare('SELECT * FROM training_attempts').all().map(attempt => ({
            ...attempt,
            results: JSON.parse(attempt.results)
        }));
        res.json({ users, trainingData, attempts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Import data and overwrite existing
app.post('/api/import', (req, res) => {
    const { users, trainingData, attempts } = req.body;

    const importTransaction = db.transaction(() => {
        // Clear all existing data
        db.exec('DELETE FROM users');
        db.exec('DELETE FROM training_items');
        db.exec('DELETE FROM training_images');
        db.exec('DELETE FROM training_attempts');
        db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'training_items', 'training_images', 'training_attempts')`);

        // Import users
        const insertUser = db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
        for (const user of users) {
            insertUser.run(user.id, user.username, user.password, user.role);
        }

        // Import training data
        const insertImage = db.prepare('INSERT INTO training_images (id, imageUrl) VALUES (?, ?)');
        const insertItem = db.prepare('INSERT INTO training_items (image_id, prompt, correctAnswer) VALUES (?, ?, ?)');
        for (const image of trainingData) {
            insertImage.run(image.id, image.imageUrl);
            for (const item of image.items) {
                insertItem.run(image.id, item.prompt, item.correctAnswer);
            }
        }
        
        // Import attempts
        const insertAttempt = db.prepare(`
            INSERT INTO training_attempts (id, username, timestamp, results, totalTime, totalItems, correctItems, accuracy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const attempt of attempts) {
            insertAttempt.run(attempt.id, attempt.username, attempt.timestamp, JSON.stringify(attempt.results), attempt.totalTime, attempt.totalItems, attempt.correctItems, attempt.accuracy);
        }
    });

    try {
        importTransaction();
        res.status(200).json({ message: 'Data imported successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Start the Server ---
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
