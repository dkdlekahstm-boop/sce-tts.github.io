export function timeToMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minToTime(min) {
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function dayType(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const wd = d.getDay();
  return wd === 0 || wd === 6 ? "weekend" : "weekday";
}

export function computeFreeWindows(wakeMin, sleepMin, fixedBlocks) {
  const blocks = fixedBlocks
    .map((b) => ({ start: timeToMin(b.start), end: timeToMin(b.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  let free = [{ start: wakeMin, end: sleepMin }];
  for (const b of blocks) {
    const next = [];
    for (const w of free) {
      if (b.end <= w.start || b.start >= w.end) {
        next.push(w);
        continue;
      }
      if (b.start > w.start) next.push({ start: w.start, end: Math.min(b.start, w.end) });
      if (b.end < w.end) next.push({ start: Math.max(b.end, w.start), end: w.end });
    }
    free = next;
  }
  return free.filter((w) => w.end - w.start > 0).sort((a, b) => a.start - b.start);
}

export function breakLength(focusUnit) {
  if (focusUnit <= 20) return 5;
  if (focusUnit <= 35) return 7;
  return 10;
}

// 5단계 템플릿(워밍업/학습/능동처리/인출테스트/마무리)을 세션 길이에 비례 배분
export function phaseSplit(totalMin) {
  const weights = { warmup: 0.1, learn: 0.4, active: 0.27, test: 0.18, wrap: 0.05 };
  const phases = {};
  let used = 0;
  for (const key of ["warmup", "active", "test", "wrap"]) {
    phases[key] = Math.max(1, Math.round(totalMin * weights[key]));
    used += phases[key];
  }
  phases.learn = totalMin - used;
  if (phases.learn < 1) {
    let need = 1 - phases.learn;
    phases.learn = 1;
    for (const key of ["active", "test", "warmup", "wrap"]) {
      const take = Math.min(need, phases[key] - 1);
      phases[key] -= take;
      need -= take;
      if (need <= 0) break;
    }
  }
  return phases;
}

export const PHASE_LABELS = {
  warmup: "워밍업 - 지난 내용 떠올리기",
  learn: "새 내용 학습",
  active: "능동적 처리 (내 말로 설명/예시 만들기)",
  test: "인출 테스트 (안 보고 떠올리기)",
  wrap: "마무리 - 체크 & 다음 복습일 확인",
};

// 약점(weakness)이 높을수록 더 자주 배정되는 가중 라운드로빈 선택기
function makePicker(subjects) {
  const counts = {};
  subjects.forEach((s) => (counts[s.id] = 0));
  return function pick() {
    let best = null;
    let bestRatio = Infinity;
    for (const s of subjects) {
      const ratio = counts[s.id] / Math.max(1, s.weakness);
      if (ratio < bestRatio - 1e-9) {
        bestRatio = ratio;
        best = s;
      }
    }
    counts[best.id]++;
    return best;
  };
}

export function generateDaySchedule(profile, dateStr) {
  const subjects = [...profile.subjects]
    .map((s, i) => ({ ...s, id: s.id ?? `s${i}` }))
    .sort((a, b) => b.weakness - a.weakness);

  const type = dayType(dateStr);
  const fixedBlocks = type === "weekend" ? profile.fixedBlocksWeekend : profile.fixedBlocksWeekday;

  const wakeMin = timeToMin(profile.wake);
  let sleepMin = timeToMin(profile.sleep);
  if (sleepMin <= wakeMin) sleepMin += 1440;

  const freeWindows = computeFreeWindows(wakeMin, sleepMin, fixedBlocks || []);
  const L = Number(profile.focusUnit) || 25;
  const B = breakLength(L);

  const assignmentOrder = profile.chronotype === "evening" ? [...freeWindows].reverse() : freeWindows;
  const picker = subjects.length ? makePicker(subjects) : null;

  let budget = Number(profile.dailyGoalMinutes) || 90;
  const rawSessions = [];

  for (const w of assignmentOrder) {
    let cursor = w.start;
    while (picker && budget >= L && cursor + L <= w.end) {
      const subject = picker();
      rawSessions.push({ start: cursor, end: cursor + L, subject });
      cursor += L + B;
      budget -= L;
    }
  }

  rawSessions.sort((a, b) => a.start - b.start);
  const sessions = rawSessions.map((s, idx) => ({
    id: `${dateStr}_${idx}`,
    index: idx,
    start: s.start,
    end: s.end,
    startLabel: minToTime(s.start),
    endLabel: minToTime(s.end),
    subject: s.subject,
    phases: phaseSplit(L),
  }));

  const reviewLen = 8;
  const reviewSlot = {
    start: sleepMin - reviewLen,
    end: sleepMin,
    startLabel: minToTime(sleepMin - reviewLen),
    endLabel: minToTime(sleepMin),
  };

  return { dateStr, dayType: type, sessions, reviewSlot, freeWindows, focusUnit: L, breakLen: B };
}
