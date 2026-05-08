const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isDev = !app.isPackaged;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (process.platform === 'linux') {
  app.setName('EyeBreak');
  app.setDesktopName('eye-break.desktop');
}

let mainWindow;
let tray;
let breakWindow;
let nextBreakAt = null;
let timer = null;
let settings = {
  workMinutes: 20,
  breakSeconds: 20,
  soundEnabled: true,
  notificationsEnabled: true,
  autoStartTimer: true,
  motivationalTips: true,
  launchAtLogin: false,
};
let paused = false;
let onBreak = false;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    settings = { ...settings, ...saved };
  } catch {
    // First run or unreadable settings file; defaults are fine.
  }
}

function saveSettings() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function applyLoginSetting() {
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.launchAtLogin),
    path: process.execPath,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 620,
    minWidth: 390,
    minHeight: 560,
    title: 'EyeBreak',
    backgroundColor: '#07111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      showNotification('EyeBreak is still running', 'I’ll keep reminding you from the tray.');
    }
  });
}

function assetPath(filename) {
  return path.join(__dirname, 'assets', filename);
}

function trayIconPath() {
  const size = process.platform === 'linux' ? 24 : 32;
  return assetPath(`tray-${size}.png`);
}

function linuxTrayIconPath() {
  const outputPath = path.join(app.getPath('userData'), 'tray-icon.png');
  const candidates = [trayIconPath(), assetPath('tray-24.png'), assetPath('tray-22.png'), assetPath('icon.png')];

  for (const candidate of candidates) {
    try {
      const image = nativeImage.createFromPath(candidate);
      if (image.isEmpty()) continue;
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, image.resize({ width: 24, height: 24 }).toPNG());
      return outputPath;
    } catch {
      // Try the next candidate.
    }
  }

  return trayIconPath();
}

function createTray() {
  if (process.platform === 'linux') {
    tray = new Tray(linuxTrayIconPath());
  } else {
    let icon = nativeImage.createFromPath(trayIconPath());
    if (icon.isEmpty()) icon = nativeImage.createFromPath(assetPath('icon.png'));
    tray = new Tray(icon);
  }
  tray.setToolTip('EyeBreak');
  updateTrayMenu();
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show EyeBreak', click: () => showMainWindow() },
    { type: 'separator' },
    { label: paused ? 'Resume reminders' : 'Pause reminders', click: () => paused ? resumeTimer() : pauseTimer() },
    { label: 'Start break now', click: () => startBreak() },
    { label: 'Reset timer', click: () => resetTimer() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

function showMainWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function startTimer() {
  clearInterval(timer);
  paused = false;
  onBreak = false;
  nextBreakAt = Date.now() + settings.workMinutes * 60 * 1000;
  timer = setInterval(tick, 1000);
  broadcastState();
  updateTrayMenu();
}

function pauseTimer() {
  paused = true;
  clearInterval(timer);
  broadcastState();
  updateTrayMenu();
}

function resumeTimer() {
  const remainingMs = Math.max(1000, nextBreakAt ? nextBreakAt - Date.now() : settings.workMinutes * 60 * 1000);
  nextBreakAt = Date.now() + remainingMs;
  paused = false;
  timer = setInterval(tick, 1000);
  broadcastState();
  updateTrayMenu();
}

function resetTimer() {
  startTimer();
}

function tick() {
  if (paused || onBreak) return;
  if (Date.now() >= nextBreakAt) {
    startBreak();
  }
  broadcastState();
}

function startBreak() {
  if (onBreak) return;
  onBreak = true;
  clearInterval(timer);
  showNotification('20-20-20 break time', 'Look at something 20 feet away for 20 seconds. Let your eyes soften.');
  createBreakWindow();
  playSound('break-start');
  broadcastState();
  updateTrayMenu();
}

function finishBreak(skipped = false) {
  if (breakWindow && !breakWindow.isDestroyed()) breakWindow.close();
  breakWindow = null;
  onBreak = false;
  startTimer();
  if (!skipped) {
    playSound('break-end');
    showNotification('Nice. Eyes reset.', 'Next reminder is in 20 minutes.');
  }
}

function createBreakWindow() {
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.focus();
    return;
  }

  breakWindow = new BrowserWindow({
    width: 560,
    height: 420,
    alwaysOnTop: true,
    resizable: false,
    title: 'EyeBreak — look away',
    backgroundColor: '#07111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  breakWindow.loadFile(path.join(__dirname, 'break.html'));
  breakWindow.on('closed', () => {
    breakWindow = null;
    if (onBreak) finishBreak(true);
  });
}

function sendSoundToWindow(window, kind) {
  if (!window || window.isDestroyed()) return;

  const send = () => {
    if (!window.isDestroyed()) window.webContents.send('play-sound', kind);
  };

  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function commandExists(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

function playNativeSound(kind) {
  if (process.platform !== 'linux') return;

  const soundFile = kind === 'break-end'
    ? '/usr/share/sounds/freedesktop/stereo/complete.oga'
    : '/usr/share/sounds/freedesktop/stereo/bell.oga';

  const players = [
    { command: 'aplay', args: ['/usr/share/sounds/alsa/Front_Center.wav'] },
    { command: 'canberra-gtk-play', args: ['-i', kind === 'break-end' ? 'complete' : 'bell'] },
    { command: 'pw-play', args: [soundFile] },
  ];

  const player = players.find(({ command }) => commandExists(command));
  if (!player) return;

  const child = spawn(player.command, player.args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

function playSound(kind) {
  if (!settings.soundEnabled) return;
  playNativeSound(kind);
  sendSoundToWindow(mainWindow, kind);
  sendSoundToWindow(breakWindow, kind);
}

function showNotification(title, body) {
  if (!settings.notificationsEnabled || !Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: true });
  notification.on('click', () => showMainWindow());
  notification.show();
}

function getState() {
  const remainingMs = paused || onBreak || !nextBreakAt
    ? Math.max(0, nextBreakAt ? nextBreakAt - Date.now() : settings.workMinutes * 60 * 1000)
    : Math.max(0, nextBreakAt - Date.now());

  return {
    settings,
    paused,
    onBreak,
    nextBreakAt,
    remainingMs,
    notificationSupported: Notification.isSupported(),
    platform: process.platform,
  };
}

function broadcastState() {
  const state = getState();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('state', state);
  if (breakWindow && !breakWindow.isDestroyed()) breakWindow.webContents.send('state', state);
  if (tray) {
    const minutes = Math.ceil(state.remainingMs / 60000);
    tray.setToolTip(onBreak ? 'EyeBreak: break time' : paused ? 'EyeBreak: paused' : `EyeBreak: ${minutes} min until break`);
  }
}

function makeTrayIcon() {
  return 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#0ea5e9"/>
      <path d="M5 16s4-7 11-7 11 7 11 7-4 7-11 7S5 16 5 16Z" fill="#e0f2fe"/>
      <circle cx="16" cy="16" r="4" fill="#075985"/>
      <circle cx="17.5" cy="14.5" r="1.4" fill="#fff"/>
    </svg>
  `).toString('base64');
}

app.whenReady().then(() => {
  loadSettings();
  applyLoginSetting();
  createWindow();
  createTray();
  if (settings.autoStartTimer) startTimer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showMainWindow();
  });
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

ipcMain.handle('get-state', () => getState());
ipcMain.handle('start', () => startTimer());
ipcMain.handle('pause', () => pauseTimer());
ipcMain.handle('resume', () => resumeTimer());
ipcMain.handle('reset', () => resetTimer());
ipcMain.handle('break-now', () => startBreak());
ipcMain.handle('finish-break', (_event, skipped) => finishBreak(Boolean(skipped)));
ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));
ipcMain.handle('update-settings', (_event, patch) => {
  settings = { ...settings, ...patch };
  saveSettings();
  applyLoginSetting();
  if (!paused && !onBreak) startTimer();
  broadcastState();
  return getState();
});
