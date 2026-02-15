const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'data', 'scores.db');

// Prevent server crash on uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize SQLite database
const db = new Database(DB_FILE);

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        score INTEGER NOT NULL,
        date TEXT NOT NULL
    )
`);

// Prepare statements for better performance
const getTop10Stmt = db.prepare('SELECT name, score, date FROM scores ORDER BY score DESC LIMIT 10');
const getByNameStmt = db.prepare('SELECT id, score FROM scores WHERE name = ?');
const insertStmt = db.prepare('INSERT INTO scores (name, score, date) VALUES (?, ?, ?)');
const updateStmt = db.prepare('UPDATE scores SET score = ?, date = ? WHERE id = ?');

function getTop10() {
    return getTop10Stmt.all();
}

function addScore(name, score) {
    const now = new Date().toISOString();
    const existing = getByNameStmt.get(name);

    if (existing) {
        // Update only if new score is higher
        if (score > existing.score) {
            updateStmt.run(score, now, existing.id);
        }
    } else {
        // Add new entry
        insertStmt.run(name, score, now);
    }

    return getTop10();
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/api/scores' && req.method === 'GET') {
        try {
            const top10 = getTop10();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(top10));
        } catch (e) {
            console.error('Error getting scores:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error' }));
        }
    } else if (req.url === '/api/scores' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('error', (err) => {
            console.error('Request error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request error' }));
        });
        req.on('end', () => {
            try {
                const { name, score } = JSON.parse(body);
                if (name && typeof score === 'number') {
                    const top10 = addScore(name, score);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(top10));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid data' }));
                }
            } catch (e) {
                console.error('Error processing score:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});

server.on('clientError', (err, socket) => {
    console.error('Client error:', err);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing database...');
    db.close();
    process.exit(0);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Leaderboard server running on http://0.0.0.0:${PORT}`);
    console.log(`Database: ${DB_FILE}`);
});
