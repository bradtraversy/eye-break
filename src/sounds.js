function playToneSequence(kind) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
  master.connect(ctx.destination);

  const notes = kind === 'break-end'
    ? [{ frequency: 660, delay: 0 }, { frequency: 880, delay: 0.16 }, { frequency: 1175, delay: 0.32 }]
    : [{ frequency: 880, delay: 0 }, { frequency: 660, delay: 0.18 }];

  notes.forEach(({ frequency, delay }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.75, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.16);
    osc.connect(gain).connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + 0.22);
  });

  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

window.eyeBreak.onSound(playToneSequence);
