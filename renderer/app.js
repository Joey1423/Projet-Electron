const statusEl = document.getElementById('status');
const whoamiEl = document.getElementById('whoami');
const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');

const labSection = document.getElementById('lab-section');
const createForm = document.getElementById('create-form');
const labNameEl = document.getElementById('lab-name');
const labSizeEl = document.getElementById('lab-size');
const labDifficultyEl = document.getElementById('lab-difficulty');
const labListEl = document.getElementById('lab-list');
const selectedMetaEl = document.getElementById('selected-meta');
const mazeCanvas = document.getElementById('maze-canvas');
const toggleSolutionBtn = document.getElementById('toggle-solution');

const adminSection = document.getElementById('admin-section');
const adminBtn = document.getElementById('load-admin');
const adminStatsEl = document.getElementById('admin-stats');
const adminUsersEl = document.getElementById('admin-users');
const adminLabsEl = document.getElementById('admin-labs');

let token = '';
let currentUser = null;
let labyrinths = [];
let selectedLabyrinthId = null;
let showSolution = true;

function setStatus(message) {
  statusEl.textContent = message;
}

function errorMessage(error) {
  return error?.message || String(error);
}

function clearCanvas() {
  const ctx = mazeCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
}

function drawLabyrinth(labyrinth) {
  const grid = labyrinth?.grid;
  if (!Array.isArray(grid) || grid.length === 0) {
    clearCanvas();
    return;
  }

  const h = grid.length;
  const w = grid[0].length;
  const cell = Math.max(4, Math.floor(Math.min(560 / w, 560 / h)));
  const width = w * cell;
  const height = h * cell;

  mazeCanvas.width = width;
  mazeCanvas.height = height;
  const ctx = mazeCanvas.getContext('2d');

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      ctx.fillStyle = grid[y][x] === 1 ? '#0b0f14' : '#f8fafc';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  if (showSolution && Array.isArray(labyrinth.solution) && labyrinth.solution.length > 0) {
    ctx.fillStyle = 'rgba(37, 99, 235, 0.65)';
    labyrinth.solution.forEach((step) => {
      ctx.fillRect(step.x * cell, step.y * cell, cell, cell);
    });
  }

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cell, cell, cell, cell);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect((w - 2) * cell, (h - 2) * cell, cell, cell);
}

function getSelectedLabyrinth() {
  return labyrinths.find((item) => item.id === selectedLabyrinthId) || null;
}

function renderSelected() {
  const selected = getSelectedLabyrinth();
  if (!selected) {
    selectedMetaEl.textContent = 'Selectionne un labyrinthe pour l\'afficher.';
    clearCanvas();
    return;
  }

  selectedMetaEl.textContent = `${selected.name} | ${selected.sizeLabel} | difficulte ${selected.difficulty} | ${selected.width}x${selected.height}`;
  drawLabyrinth(selected);
}

function makeButton(label, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.addEventListener('click', onClick);
  return button;
}

function renderLabyrinths() {
  labListEl.innerHTML = '';

  if (labyrinths.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-item';
    empty.textContent = 'Aucun labyrinthe pour le moment.';
    labListEl.appendChild(empty);
    selectedLabyrinthId = null;
    renderSelected();
    return;
  }

  if (!labyrinths.some((item) => item.id === selectedLabyrinthId)) {
    selectedLabyrinthId = labyrinths[0].id;
  }

  labyrinths.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';

    const line = document.createElement('div');
    line.className = 'item-line';
    const info = document.createElement('strong');
    info.textContent = `${item.name} (${item.sizeLabel}, diff ${item.difficulty})`;

    const selectBtn = makeButton('Voir', () => {
      selectedLabyrinthId = item.id;
      renderSelected();
    }, 'secondary');

    line.appendChild(info);
    line.appendChild(selectBtn);

    const actions = document.createElement('div');
    actions.className = 'actions';

    actions.appendChild(
      makeButton('Renommer', async () => {
        const newName = window.prompt('Nouveau nom :', item.name);
        if (!newName) {
          return;
        }
        try {
          await window.api.updateLabyrinth(token, { id: item.id, name: newName });
          await refreshLabyrinths(item.id);
          setStatus('Labyrinthe renomme.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      }, 'secondary')
    );

    actions.appendChild(
      makeButton('Regenerer', async () => {
        const sizeLabel = window.prompt('Taille (petite/moyenne/grande) :', item.sizeLabel) || item.sizeLabel;
        const difficulty = Number(window.prompt('Difficulte (1-10) :', String(item.difficulty)) || item.difficulty);
        try {
          await window.api.generateLabyrinth(token, { id: item.id, sizeLabel, difficulty });
          await refreshLabyrinths(item.id);
          setStatus('Labyrinthe regenere.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      })
    );

    actions.appendChild(
      makeButton('Resoudre', async () => {
        try {
          await window.api.solveLabyrinth(token, item.id);
          await refreshLabyrinths(item.id);
          setStatus('Solution recalculee.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      })
    );

    actions.appendChild(
      makeButton('Supprimer', async () => {
        const ok = window.confirm(`Supprimer ${item.name} ?`);
        if (!ok) {
          return;
        }
        try {
          await window.api.deleteLabyrinth(token, item.id);
          await refreshLabyrinths();
          setStatus('Labyrinthe supprime.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      }, 'secondary')
    );

    wrapper.appendChild(line);
    wrapper.appendChild(actions);
    labListEl.appendChild(wrapper);
  });

  renderSelected();
}

async function refreshLabyrinths(preferredId = null) {
  labyrinths = await window.api.listLabyrinths(token);
  if (preferredId) {
    selectedLabyrinthId = preferredId;
  }
  renderLabyrinths();
}

function renderAdmin(stats, users, labs) {
  adminStatsEl.innerHTML = '';
  adminUsersEl.innerHTML = '';
  adminLabsEl.innerHTML = '';

  const boxes = [
    `Utilisateurs: ${stats.totalUsers}`,
    `Labyrinthes: ${stats.totalLabyrinths}`,
    `Top createur: ${stats.byUser[0]?.username || '-'}`,
  ];
  boxes.forEach((label) => {
    const box = document.createElement('div');
    box.className = 'stat-box';
    box.textContent = label;
    adminStatsEl.appendChild(box);
  });

  users.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'list-item';

    const line = document.createElement('div');
    line.className = 'item-line';
    line.textContent = `${user.username} | role: ${user.role} | labyrinthes: ${user.labyrinthCount}`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    actions.appendChild(
      makeButton(user.role === 'admin' ? 'Passer user' : 'Passer admin', async () => {
        try {
          await window.api.adminUpdateUser(token, {
            id: user.id,
            role: user.role === 'admin' ? 'user' : 'admin',
          });
          await loadAdminData();
          setStatus('Role utilisateur mis a jour.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      }, 'secondary')
    );

    actions.appendChild(
      makeButton('Supprimer', async () => {
        if (!window.confirm(`Supprimer l'utilisateur ${user.username} ?`)) {
          return;
        }
        try {
          await window.api.adminDeleteUser(token, user.id);
          await loadAdminData();
          setStatus('Utilisateur supprime.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      })
    );

    row.appendChild(line);
    row.appendChild(actions);
    adminUsersEl.appendChild(row);
  });

  labs.forEach((lab) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    const line = document.createElement('div');
    line.className = 'item-line';
    line.textContent = `${lab.name} | ${lab.owner} | ${lab.sizeLabel} | diff ${lab.difficulty}`;

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(
      makeButton('Supprimer', async () => {
        if (!window.confirm(`Supprimer le labyrinthe ${lab.name} ?`)) {
          return;
        }
        try {
          await window.api.adminDeleteLabyrinth(token, lab.id);
          await loadAdminData();
          if (currentUser) {
            await refreshLabyrinths(selectedLabyrinthId);
          }
          setStatus('Labyrinthe supprime par admin.');
        } catch (error) {
          setStatus(errorMessage(error));
        }
      }, 'secondary')
    );

    row.appendChild(line);
    row.appendChild(actions);
    adminLabsEl.appendChild(row);
  });
}

async function loadAdminData() {
  const [stats, users, labs] = await Promise.all([
    window.api.adminStats(token),
    window.api.adminListUsers(token),
    window.api.adminListAllLabyrinths(token),
  ]);
  renderAdmin(stats, users, labs);
}

function applyLoginState() {
  const loggedIn = Boolean(token && currentUser);
  authSection.classList.toggle('hidden', loggedIn);
  labSection.classList.toggle('hidden', !loggedIn);
  logoutBtn.classList.toggle('hidden', !loggedIn);

  if (!loggedIn) {
    whoamiEl.textContent = 'Non connecte';
    adminSection.classList.add('hidden');
    clearCanvas();
    selectedMetaEl.textContent = 'Selectionne un labyrinthe pour l\'afficher.';
    return;
  }

  whoamiEl.textContent = `${currentUser.username} (${currentUser.role})`;
  adminSection.classList.toggle('hidden', currentUser.role !== 'admin');
}

async function postLogin(authResult) {
  token = authResult.token;
  currentUser = authResult.user;
  applyLoginState();
  await refreshLabyrinths();
  if (currentUser.role === 'admin') {
    await loadAdminData();
  }
  setStatus(`Connecte: ${currentUser.username} (${currentUser.role})`);
}

registerBtn.addEventListener('click', async () => {
  try {
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    if (!username || password.length < 6) {
      setStatus('Nom utilisateur requis et mot de passe >= 6 caracteres.');
      return;
    }
    const authResult = await window.api.register({ username, password });
    await postLogin(authResult);
  } catch (error) {
    setStatus(errorMessage(error));
  }
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    if (!username || !password) {
      setStatus('Saisis ton nom utilisateur et ton mot de passe.');
      return;
    }
    const authResult = await window.api.login({ username, password });
    await postLogin(authResult);
  } catch (error) {
    setStatus(errorMessage(error));
  }
});

logoutBtn.addEventListener('click', () => {
  token = '';
  currentUser = null;
  labyrinths = [];
  selectedLabyrinthId = null;
  labListEl.innerHTML = '';
  adminStatsEl.innerHTML = '';
  adminUsersEl.innerHTML = '';
  adminLabsEl.innerHTML = '';
  applyLoginState();
  setStatus('Deconnecte.');
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const created = await window.api.createLabyrinth(token, {
      name: labNameEl.value.trim() || 'Labyrinthe',
      sizeLabel: labSizeEl.value,
      difficulty: Number(labDifficultyEl.value || 1),
    });
    labNameEl.value = '';
    await refreshLabyrinths(created.id);
    setStatus('Labyrinthe cree.');
  } catch (error) {
    setStatus(errorMessage(error));
  }
});

toggleSolutionBtn.addEventListener('click', () => {
  showSolution = !showSolution;
  renderSelected();
  setStatus(showSolution ? 'Affichage de la solution active.' : 'Affichage de la solution masque.');
});

adminBtn.addEventListener('click', async () => {
  try {
    await loadAdminData();
    setStatus('Donnees admin rechargees.');
  } catch (error) {
    setStatus(errorMessage(error));
  }
});

applyLoginState();
setStatus('Inscris-toi ou connecte-toi pour commencer.');
