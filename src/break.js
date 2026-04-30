const breakCount = document.querySelector('#breakCount');
const doneBtn = document.querySelector('#doneBtn');
const skipBtn = document.querySelector('#skipBtn');

let breakEndsAt = Date.now() + 20_000;
let countdown;

async function start() {
  const state = await window.eyeBreak.getState();
  const breakSeconds = Number(state.settings.breakSeconds) || 20;
  breakEndsAt = Date.now() + breakSeconds * 1000;
  render();
  countdown = setInterval(() => {
    render();
    if (Date.now() >= breakEndsAt) {
      clearInterval(countdown);
      window.eyeBreak.finishBreak(false);
    }
  }, 250);
}

function render() {
  const secondsLeft = Math.max(0, Math.ceil((breakEndsAt - Date.now()) / 1000));
  breakCount.textContent = secondsLeft;
}

doneBtn.addEventListener('click', () => {
  clearInterval(countdown);
  window.eyeBreak.finishBreak(false);
});

skipBtn.addEventListener('click', () => {
  clearInterval(countdown);
  window.eyeBreak.finishBreak(true);
});

start();
