const timeRemaining = document.querySelector('#timeRemaining');
const statusText = document.querySelector('#statusText');
const pauseBtn = document.querySelector('#pauseBtn');
const resetBtn = document.querySelector('#resetBtn');
const breakNowBtn = document.querySelector('#breakNowBtn');
const workMinutes = document.querySelector('#workMinutes');
const breakSeconds = document.querySelector('#breakSeconds');
const notificationsEnabled = document.querySelector('#notificationsEnabled');
const soundEnabled = document.querySelector('#soundEnabled');
const launchAtLogin = document.querySelector('#launchAtLogin');

let currentState;

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function render(state) {
  currentState = state;
  timeRemaining.textContent = formatMs(state.remainingMs);
  statusText.textContent = state.onBreak ? 'Break in progress' : state.paused ? 'Paused' : 'Next eye break';
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  workMinutes.value = String(state.settings.workMinutes);
  breakSeconds.value = String(state.settings.breakSeconds);
  notificationsEnabled.checked = state.settings.notificationsEnabled;
  soundEnabled.checked = state.settings.soundEnabled;
  launchAtLogin.checked = state.settings.launchAtLogin;
}

pauseBtn.addEventListener('click', async () => {
  if (currentState?.paused) await window.eyeBreak.resume();
  else await window.eyeBreak.pause();
});
resetBtn.addEventListener('click', () => window.eyeBreak.reset());
breakNowBtn.addEventListener('click', () => window.eyeBreak.breakNow());

for (const input of [workMinutes, breakSeconds, notificationsEnabled, soundEnabled, launchAtLogin]) {
  input.addEventListener('change', () => {
    window.eyeBreak.updateSettings({
      workMinutes: Number(workMinutes.value),
      breakSeconds: Number(breakSeconds.value),
      notificationsEnabled: notificationsEnabled.checked,
      soundEnabled: soundEnabled.checked,
      launchAtLogin: launchAtLogin.checked,
    });
  });
}

window.eyeBreak.onState(render);
window.eyeBreak.getState().then(render);
setInterval(() => currentState && render(currentState), 1000);
