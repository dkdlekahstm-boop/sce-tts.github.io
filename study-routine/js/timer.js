export class PhaseTimer {
  constructor({ totalSeconds, onTick, onComplete }) {
    this.totalSeconds = totalSeconds;
    this.remaining = totalSeconds;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.intervalId = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => {
      this.remaining -= 1;
      this.onTick?.(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onComplete?.();
      }
    }, 1000);
  }

  pause() {
    this.running = false;
    clearInterval(this.intervalId);
  }

  stop() {
    this.running = false;
    clearInterval(this.intervalId);
  }
}

export function formatSeconds(sec) {
  const clamped = Math.max(0, sec);
  const m = String(Math.floor(clamped / 60)).padStart(2, "0");
  const s = String(clamped % 60).padStart(2, "0");
  return `${m}:${s}`;
}
