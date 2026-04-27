const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'ynov-labyrinth-secret';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function verifyToken(token) {
  if (!token) {
    throw new Error('Token manquant');
  }
  return jwt.verify(token, JWT_SECRET);
}

async function getUserFromToken(token) {
  const payload = verifyToken(token);
  const user = await get('SELECT id, username, role FROM users WHERE id = ?', [payload.sub]);
  if (!user) {
    throw new Error('Utilisateur introuvable');
  }
  return user;
}

ipcMain.handle('auth:register', async (_event, payload) => {
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');

  if (!username || password.length < 6) {
    throw new Error('Nom utilisateur requis et mot de passe >= 6 caracteres');
  }

  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    throw new Error('Nom utilisateur deja utilise');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, 'user']
  );

  const user = { id: result.lastID, username, role: 'user' };
  const token = signToken(user);

  return { token, user };
});

ipcMain.handle('auth:login', async (_event, payload) => {
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');

  const row = await get('SELECT id, username, role, password_hash FROM users WHERE username = ?', [username]);
  if (!row) {
    throw new Error('Identifiants invalides');
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    throw new Error('Identifiants invalides');
  }

  const user = { id: row.id, username: row.username, role: row.role };
  const token = signToken(user);

  return { token, user };
});

ipcMain.handle('auth:me', async (_event, token) => {
  const user = await getUserFromToken(token);
  return { user };
});

module.exports = {
  getUserFromToken,
};
