const stage = document.getElementById('stage');
const actionSelect = document.getElementById('action-select');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
const colorPicker = document.getElementById('color-picker');
const toggleBtn = document.getElementById('toggle-play');

// 동작별 기본 사이클 길이(초). 여기에 속도 배율을 나눠서 --dur을 정한다.
const BASE_DURATION = {
  walk: 1,
  run: 0.6,
  jump: 1.2,
  wave: 0.9,
  idle: 1,
};

function applyDuration() {
  const action = actionSelect.value;
  const speed = parseFloat(speedRange.value);
  const duration = BASE_DURATION[action] / speed;
  stage.style.setProperty('--dur', `${duration}s`);
}

actionSelect.addEventListener('change', () => {
  stage.dataset.action = actionSelect.value;
  applyDuration();
});

speedRange.addEventListener('input', () => {
  speedValue.textContent = `${parseFloat(speedRange.value).toFixed(1)}x`;
  applyDuration();
});

colorPicker.addEventListener('input', () => {
  stage.style.setProperty('--char-color', colorPicker.value);
});

let playing = true;
toggleBtn.addEventListener('click', () => {
  playing = !playing;
  stage.classList.toggle('paused', !playing);
  toggleBtn.textContent = playing ? '⏸ 일시정지' : '▶ 재생';
});

applyDuration();
stage.style.setProperty('--char-color', colorPicker.value);
