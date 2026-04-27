const { ipcMain } = require('electron');
const { run, get, all } = require('./database');
const { getUserFromToken } = require('./auth');

const SIZE_MAP = {
  petite: { w: 15, h: 15 },
  moyenne: { w: 25, h: 25 },
  grande: { w: 35, h: 35 },
};

function clampDifficulty(value) {
  const difficulty = Number(value);
  if (Number.isNaN(difficulty)) {
    return 1;
  }
  return Math.max(1, Math.min(10, Math.floor(difficulty)));
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateLabyrinthGrid(sizeLabel, difficultyValue) {
  const size = SIZE_MAP[sizeLabel] || SIZE_MAP.moyenne;
  const width = size.w;
  const height = size.h;
  const difficulty = clampDifficulty(difficultyValue);

  const grid = Array.from({ length: height }, () => Array(width).fill(1));

  function inBounds(x, y) {
    return x > 0 && x < width - 1 && y > 0 && y < height - 1;
  }

  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ].sort(() => Math.random() - 0.5);

    dirs.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    });
  }

  carve(1, 1);

  const extraOpenings = Math.floor((difficulty / 10) * (width * height * 0.08));
  for (let i = 0; i < extraOpenings; i += 1) {
    const x = 1 + Math.floor(Math.random() * (width - 2));
    const y = 1 + Math.floor(Math.random() * (height - 2));
    grid[y][x] = 0;
  }

  grid[1][1] = 0;
  grid[height - 2][width - 2] = 0;

  return {
    width,
    height,
    grid,
    difficulty,
    sizeLabel,
  };
}

function solveLabyrinthGrid(grid) {
  const height = grid.length;
  const width = grid[0].length;

  const start = { x: 1, y: 1 };
  const end = { x: width - 2, y: height - 2 };

  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const parent = new Map();

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length) {
    const current = queue.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let key = `${end.x},${end.y}`;
      while (key) {
        const [x, y] = key.split(',').map(Number);
        path.push({ x, y });
        key = parent.get(key);
      }
      return path.reverse();
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      if (grid[ny][nx] !== 0) {
        continue;
      }
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      parent.set(key, `${current.x},${current.y}`);
      queue.push({ x: nx, y: ny });
    }
  }

  return [];
}

function toEntity(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sizeLabel: row.size_label,
    width: row.width,
    height: row.height,
    difficulty: row.difficulty,
    grid: JSON.parse(row.grid_json),
    solution: row.solution_json ? JSON.parse(row.solution_json) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

ipcMain.handle('labyrinth:list', async (_event, token) => {
  const user = await getUserFromToken(token);
  const rows = await all(
    `SELECT * FROM labyrinths
     WHERE user_id = ?
     ORDER BY datetime(updated_at) DESC`,
    [user.id]
  );
  return rows.map(toEntity);
});

ipcMain.handle('labyrinth:create', async (_event, token, payload) => {
  const user = await getUserFromToken(token);
  const name = String(payload?.name || '').trim() || 'Nouveau labyrinthe';
  const sizeLabel = String(payload?.sizeLabel || 'moyenne');
  const difficulty = clampDifficulty(payload?.difficulty);

  const generated = generateLabyrinthGrid(sizeLabel, difficulty);
  const solution = solveLabyrinthGrid(generated.grid);

  const result = await run(
    `INSERT INTO labyrinths
      (user_id, name, size_label, width, height, difficulty, grid_json, solution_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      name,
      generated.sizeLabel,
      generated.width,
      generated.height,
      generated.difficulty,
      JSON.stringify(generated.grid),
      JSON.stringify(solution),
    ]
  );

  const created = await get('SELECT * FROM labyrinths WHERE id = ?', [result.lastID]);
  return toEntity(created);
});

ipcMain.handle('labyrinth:update', async (_event, token, payload) => {
  const user = await getUserFromToken(token);
  const labyrinthId = Number(payload?.id);
  const name = String(payload?.name || '').trim() || 'Labyrinthe';

  const row = await get('SELECT * FROM labyrinths WHERE id = ? AND user_id = ?', [labyrinthId, user.id]);
  if (!row) {
    throw new Error('Labyrinthe introuvable');
  }

  await run(
    'UPDATE labyrinths SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, labyrinthId]
  );

  const updated = await get('SELECT * FROM labyrinths WHERE id = ?', [labyrinthId]);
  return toEntity(updated);
});

ipcMain.handle('labyrinth:delete', async (_event, token, labyrinthId) => {
  const user = await getUserFromToken(token);
  const id = Number(labyrinthId);

  const row = await get('SELECT id FROM labyrinths WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!row) {
    throw new Error('Labyrinthe introuvable');
  }

  await run('DELETE FROM labyrinths WHERE id = ?', [id]);
  return { ok: true };
});

ipcMain.handle('labyrinth:generate', async (_event, token, payload) => {
  const user = await getUserFromToken(token);
  const labyrinthId = Number(payload?.id);
  const sizeLabel = String(payload?.sizeLabel || 'moyenne');
  const difficulty = clampDifficulty(payload?.difficulty);

  const row = await get('SELECT * FROM labyrinths WHERE id = ? AND user_id = ?', [labyrinthId, user.id]);
  if (!row) {
    throw new Error('Labyrinthe introuvable');
  }

  const generated = generateLabyrinthGrid(sizeLabel, difficulty);
  const solution = solveLabyrinthGrid(generated.grid);

  await run(
    `UPDATE labyrinths
     SET size_label = ?, width = ?, height = ?, difficulty = ?, grid_json = ?, solution_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      generated.sizeLabel,
      generated.width,
      generated.height,
      generated.difficulty,
      JSON.stringify(generated.grid),
      JSON.stringify(solution),
      labyrinthId,
    ]
  );

  const updated = await get('SELECT * FROM labyrinths WHERE id = ?', [labyrinthId]);
  return toEntity(updated);
});

ipcMain.handle('labyrinth:solve', async (_event, token, labyrinthId) => {
  const user = await getUserFromToken(token);
  const id = Number(labyrinthId);

  const row = await get('SELECT * FROM labyrinths WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!row) {
    throw new Error('Labyrinthe introuvable');
  }

  const grid = JSON.parse(row.grid_json);
  const solution = solveLabyrinthGrid(grid);

  await run(
    'UPDATE labyrinths SET solution_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(solution), id]
  );

  const updated = await get('SELECT * FROM labyrinths WHERE id = ?', [id]);
  return toEntity(updated);
});

module.exports = {
  generateLabyrinthGrid,
  solveLabyrinthGrid,
  randomChoice,
};
