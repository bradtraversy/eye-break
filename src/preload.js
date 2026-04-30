const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyeBreak', {
  getState: () => ipcRenderer.invoke('get-state'),
  start: () => ipcRenderer.invoke('start'),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  reset: () => ipcRenderer.invoke('reset'),
  breakNow: () => ipcRenderer.invoke('break-now'),
  finishBreak: (skipped) => ipcRenderer.invoke('finish-break', skipped),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onState: (callback) => ipcRenderer.on('state', (_event, state) => callback(state)),
  onSound: (callback) => ipcRenderer.on('play-sound', (_event, kind) => callback(kind)),
});
