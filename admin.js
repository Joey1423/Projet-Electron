const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const { run, get, all } = require('./database');
const { getUserFromToken } = require('./auth');

async function requireAdmin(token) {
  const user = await getUserFromToken(token);
  if (user.role !== 'admin') {
    throw new Error('Acces administrateur requis');
  }
  return user;
}

ipcMain.handle('admin:users:list', async (_event, token) => {
  await requireAdmin(token);

  const rows = await all(
    `SELECT id, username, role, created_at,
            (SELECT COUNT(*) FROM labyrinths l WHERE l.user_id = users.id) AS labyrinth_count
     FROM users
     ORDER BY datetime(created_at) ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    labyrinthCount: row.labyrinth_count,
  }));
});

ipcMain.handle('admin:users:update', async (_event, token, payload) => {
  const admin = await requireAdmin(token);
  const userId = Number(payload?.id);
  const role = payload?.role === 'admin' ? 'admin' : 'user';
  const username = String(payload?.username || '').trim();
  const password = String(payload?.password || '');

  const target = await get('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!target) {
    throw new Error('Utilisateur introuvable');
  }

  if (target.id === admin.id && role !== 'admin') {
    throw new Error('Impossible de retirer votre propre role admin');
  }

  if (username) {
    await run('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
  }

  if (password.length >= 6) {
    const passwordHash = await bcrypt.hash(password, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  }

  await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

  const updated = await get('SELECT id, username, role, created_at FROM users WHERE id = ?', [userId]);
  return {
    id: updated.id,
    username: updated.username,
    role: updated.role,
    createdAt: updated.created_at,
  };
});

ipcMain.handle('admin:users:delete', async (_event, token, userId) => {
  const admin = await requireAdmin(token);
  const id = Number(userId);

  if (admin.id === id) {
    throw new Error('Suppression de votre propre compte admin interdite');
  }

  await run('DELETE FROM labyrinths WHERE user_id = ?', [id]);
  await run('DELETE FROM users WHERE id = ?', [id]);

  return { ok: true };
});

ipcMain.handle('admin:labyrinths:list', async (_event, token) => {
  await requireAdmin(token);

  const rows = await all(
    `SELECT l.id, l.name, l.size_label, l.difficulty, l.created_at, u.username
     FROM labyrinths l
     JOIN users u ON u.id = l.user_id
     ORDER BY datetime(l.created_at) DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sizeLabel: row.size_label,
    difficulty: row.difficulty,
    owner: row.username,
    createdAt: row.created_at,
  }));
});

ipcMain.handle('admin:labyrinths:delete', async (_event, token, labyrinthId) => {
  await requireAdmin(token);
  await run('DELETE FROM labyrinths WHERE id = ?', [Number(labyrinthId)]);
  return { ok: true };
});

ipcMain.handle('admin:stats', async (_event, token) => {
  await requireAdmin(token);

  const totalUsers = await get('SELECT COUNT(*) AS value FROM users');
  const totalLabyrinths = await get('SELECT COUNT(*) AS value FROM labyrinths');
  const byUser = await all(
    `SELECT u.username, COUNT(l.id) AS count
     FROM users u
     LEFT JOIN labyrinths l ON l.user_id = u.id
     GROUP BY u.id, u.username
     ORDER BY count DESC, u.username ASC`
  );

  return {
    totalUsers: totalUsers.value,
    totalLabyrinths: totalLabyrinths.value,
    byUser,
  };
});
