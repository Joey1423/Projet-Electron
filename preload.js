const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  register: (payload) => ipcRenderer.invoke('auth:register', payload),
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  me: (token) => ipcRenderer.invoke('auth:me', token),

  listLabyrinths: (token) => ipcRenderer.invoke('labyrinth:list', token),
  createLabyrinth: (token, payload) => ipcRenderer.invoke('labyrinth:create', token, payload),
  updateLabyrinth: (token, payload) => ipcRenderer.invoke('labyrinth:update', token, payload),
  deleteLabyrinth: (token, labyrinthId) => ipcRenderer.invoke('labyrinth:delete', token, labyrinthId),

  generateLabyrinth: (token, payload) => ipcRenderer.invoke('labyrinth:generate', token, payload),
  solveLabyrinth: (token, labyrinthId) => ipcRenderer.invoke('labyrinth:solve', token, labyrinthId),

  adminListUsers: (token) => ipcRenderer.invoke('admin:users:list', token),
  adminUpdateUser: (token, payload) => ipcRenderer.invoke('admin:users:update', token, payload),
  adminDeleteUser: (token, userId) => ipcRenderer.invoke('admin:users:delete', token, userId),
  adminListAllLabyrinths: (token) => ipcRenderer.invoke('admin:labyrinths:list', token),
  adminDeleteLabyrinth: (token, labyrinthId) => ipcRenderer.invoke('admin:labyrinths:delete', token, labyrinthId),
  adminStats: (token) => ipcRenderer.invoke('admin:stats', token),
});
