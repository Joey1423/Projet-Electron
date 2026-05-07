const statusEl = document.getElementById('status');

// Modal functions to replace prompt() and confirm()
let modalOverlay, modalMessage, modalInput, modalOkBtn, modalCancelBtn;

function initializeModal() {
  modalOverlay = document.getElementById('modal-overlay');
  modalMessage = document.getElementById('modal-message');
  modalInput = document.getElementById('modal-input');
  modalOkBtn = document.getElementById('modal-ok');
  modalCancelBtn = document.getElementById('modal-cancel');
}

function showModal(message, defaultValue = '', isPrompt = true) {
  return new Promise((resolve) => {
    modalMessage.textContent = message;
    
    if (isPrompt) {
      modalInput.style.display = 'block';
      modalInput.value = defaultValue || '';
      modalInput.focus();
    } else {
      modalInput.style.display = 'none';
    }
    
    modalOverlay.classList.remove('hidden');
    
    function onOk() {
      cleanup();
      resolve(isPrompt ? modalInput.value : true);
    }
    
    function onCancel() {
      cleanup();
      resolve(isPrompt ? null : false);
    }
    
    function cleanup() {
      modalOkBtn.removeEventListener('click', onOk);
      modalCancelBtn.removeEventListener('click', onCancel);
      modalInput.removeEventListener('keypress', onKeypress);
      modalOverlay.classList.add('hidden');
    }
    
    function onKeypress(e) {
      if (e.key === 'Enter') {
        onOk();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    }
    
    modalOkBtn.addEventListener('click', onOk);
    modalCancelBtn.addEventListener('click', onCancel);
    modalInput.addEventListener('keypress', onKeypress);
  });
}

function customPrompt(message, defaultValue = '') {
  return showModal(message, defaultValue, true);
}

function customConfirm(message) {
  return showModal(message, '', false);
}

// Initialize modal elements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeModal);
} else {
  initializeModal();
}

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
let showSolution = false;

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
      ctx.fillStyle = grid[y][x] === 1 ? '#334155' : '#020617'; // Walls vs Path
      ctx.fillRect(x * cell, y * cell, cell, cell);
      
      // Add subtle inner shadow to walls for depth
      if (grid[y][x] === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x * cell, y * cell, cell, 1);
      }
    }
  }

  if (showSolution && Array.isArray(labyrinth.solution) && labyrinth.solution.length > 0) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#3b82f6';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    labyrinth.solution.forEach((step) => {
      ctx.fillRect(step.x * cell + cell/4, step.y * cell + cell/4, cell/2, cell/2);
    });
    ctx.shadowBlur = 0;
  }

  // Start (Emerald)
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#10b981';
  ctx.fillStyle = '#10b981';
  ctx.fillRect(cell + 2, cell + 2, cell - 4, cell - 4);
  
  // End (Rose/Red)
  ctx.shadowColor = '#f43f5e';
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect((w - 2) * cell + 2, (h - 2) * cell + 2, cell - 4, cell - 4);
  ctx.shadowBlur = 0;
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

function makeButton(htmlLabel, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = htmlLabel;
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
    empty.className = 'lab-item';
    empty.style.cursor = 'default';
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
    wrapper.className = `lab-item ${item.id === selectedLabyrinthId ? 'selected' : ''}`;
    
    const h4 = document.createElement('h4');
    h4.textContent = item.name;
    
    const p = document.createElement('p');
    p.textContent = `${item.sizeLabel} • Diff ${item.difficulty} • ${item.width}x${item.height}`;

    wrapper.appendChild(h4);
    wrapper.appendChild(p);

    wrapper.addEventListener('click', () => {
      selectedLabyrinthId = item.id;
      renderLabyrinths(); // Refresh to update 'selected' class
    });

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.marginTop = '12px';

    actions.appendChild(
      makeButton('<i class="fas fa-edit"></i>', async (e) => {
        e.stopPropagation();
        const newName = await customPrompt('Nouveau nom :', item.name);
        if (!newName || newName.trim() === '') return;
        try {
          const updated = await window.api.updateLabyrinth(token, { id: item.id, name: newName });
          const idx = labyrinths.findIndex(l => l.id === item.id);
          if (idx !== -1) labyrinths[idx] = updated;
          renderLabyrinths();
          setStatus('Labyrinthe renommé.');
        } catch (error) { setStatus(errorMessage(error)); }
      }, 'secondary')
    );

    actions.appendChild(
      makeButton('<i class="fas fa-sync-alt"></i>', async (e) => {
        e.stopPropagation();
        try {
          await window.api.generateLabyrinth(token, { id: item.id, sizeLabel: item.sizeLabel, difficulty: item.difficulty });
          await refreshLabyrinths(item.id);
          setStatus('Labyrinthe régénéré.');
        } catch (error) { setStatus(errorMessage(error)); }
      }, 'secondary')
    );

    actions.appendChild(
      makeButton('<i class="fas fa-trash"></i>', async (e) => {
        e.stopPropagation();
        const ok = await customConfirm(`Supprimer ${item.name} ?`);
        if (!ok) return;
        try {
          await window.api.deleteLabyrinth(token, item.id);
          await refreshLabyrinths();
          setStatus('Labyrinthe supprimé.');
        } catch (error) { setStatus(errorMessage(error)); }
      }, 'secondary danger')
    );

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

  const labels = [
    { label: 'Utilisateurs', value: stats.totalUsers },
    { label: 'Labyrinthes', value: stats.totalLabyrinths },
    { label: 'Top Créateur', value: stats.byUser[0]?.username || '-' },
  ];
  labels.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<span class="value">${item.value}</span><span class="label">${item.label}</span>`;
    adminStatsEl.appendChild(card);
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
      makeButton(user.role === 'admin' ? '<i class="fas fa-user"></i> Passer user' : '<i class="fas fa-user-shield"></i> Passer admin', async () => {
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
      makeButton('<i class="fas fa-user-slash"></i> Supprimer', async () => {
        if (!await customConfirm(`Supprimer l'utilisateur ${user.username} ?`)) {
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
      makeButton('<i class="fas fa-trash-alt"></i> Supprimer', async () => {
        if (!await customConfirm(`Supprimer le labyrinthe ${lab.name} ?`)) {
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
  
  // Sidebar elements
  document.getElementById('user-display').classList.toggle('hidden', !loggedIn);
  document.getElementById('logout-btn').classList.toggle('hidden', !loggedIn);
  document.getElementById('nav-admin').classList.toggle('hidden', !loggedIn || currentUser.role !== 'admin');
  
  if (!loggedIn) {
    labSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    clearCanvas();
    selectedMetaEl.textContent = 'Sélectionne un labyrinthe.';
    return;
  }

  whoamiEl.textContent = currentUser.username;
  document.getElementById('user-role-label').textContent = currentUser.role;
  document.getElementById('avatar-char').textContent = currentUser.username.charAt(0).toUpperCase();
  
  // Show maze section by default if not already in admin
  if (adminSection.classList.contains('hidden')) {
    window.showView('lab-section');
  }
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

// Handle Delete key for deleting selected labyrinth
document.addEventListener('keydown', async (e) => {
  if (e.key === 'Delete' && selectedLabyrinthId && token && currentUser && labSection.classList.contains('hidden') === false) {
    const selected = getSelectedLabyrinth();
    if (!selected) return;
    
    const ok = await customConfirm(`Supprimer ${selected.name} ?`);
    if (!ok) return;
    
    try {
      await window.api.deleteLabyrinth(token, selected.id);
      await refreshLabyrinths();
      setStatus('Labyrinthe supprime.');
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }
});
