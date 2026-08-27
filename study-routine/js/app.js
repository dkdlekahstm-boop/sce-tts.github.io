import {
  DEFAULT_SUBJECTS,
  TRIGGERS,
  TRIGGER_TIPS,
  ATOMIC_ACTIONS,
  ENCOURAGEMENTS,
  BADGES,
  RESEARCH,
  levelFromXP,
  xpForLevel,
} from "./data.js";
import * as storage from "./storage.js";
import { generateDaySchedule, PHASE_LABELS } from "./scheduler.js";
import { PhaseTimer, formatSeconds } from "./timer.js";

const PHASE_ORDER = ["warmup", "learn", "active", "test", "wrap"];
const XP_PER_MIN = 2;

const el = (id) => document.getElementById(id);

let activeTimer = null; // { sessionId, phaseKey, timer }

// ---------------- Onboarding form dynamic rows ----------------

function makeSubjectRow(name = "", weakness = 3) {
  const row = document.createElement("div");
  row.className = "subject-row";
  row.innerHTML = `
    <input type="text" class="subj-name" placeholder="과목명" value="${escapeAttr(name)}" required />
    <input type="range" class="subj-weakness" min="1" max="5" value="${weakness}" />
    <span class="weakness-val">${weakness}</span>
    <button type="button" class="remove-btn" title="삭제">✕</button>
  `;
  const range = row.querySelector(".subj-weakness");
  const val = row.querySelector(".weakness-val");
  range.addEventListener("input", () => (val.textContent = range.value));
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
  return row;
}

function makeFixedRow(name = "", start = "", end = "") {
  const row = document.createElement("div");
  row.className = "fixed-row";
  row.innerHTML = `
    <input type="text" class="fixed-name" placeholder="일정 이름 (예: 학교)" value="${escapeAttr(name)}" required />
    <input type="time" class="fixed-start" value="${start}" required />
    <span>~</span>
    <input type="time" class="fixed-end" value="${end}" required />
    <button type="button" class="remove-btn" title="삭제">✕</button>
  `;
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
  return row;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;");
}

function renderTriggerCheckboxes() {
  const grid = el("triggers-grid");
  grid.innerHTML = "";
  for (const t of TRIGGERS) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${t.id}" id="trigger-${t.id}" /> ${t.label}`;
    grid.appendChild(label);
  }
}

function setupOnboardingStatic() {
  renderTriggerCheckboxes();
  el("add-subject-btn").addEventListener("click", () => {
    el("subjects-list").appendChild(makeSubjectRow());
  });
  document.querySelectorAll("[data-add-fixed]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listId = btn.dataset.addFixed === "weekday" ? "fixed-weekday-list" : "fixed-weekend-list";
      el(listId).appendChild(makeFixedRow());
    });
  });
  el("onboarding-form").addEventListener("submit", onSubmitOnboarding);
}

function fillOnboardingDefaults() {
  el("subjects-list").innerHTML = "";
  DEFAULT_SUBJECTS.forEach((s) => el("subjects-list").appendChild(makeSubjectRow(s.name, s.weakness)));
  el("fixed-weekday-list").innerHTML = "";
  el("fixed-weekend-list").innerHTML = "";
}

function fillOnboardingFromProfile(profile) {
  el("f-name").value = profile.name || "";
  el("f-wake").value = profile.wake;
  el("f-sleep").value = profile.sleep;
  el("f-chronotype").value = profile.chronotype;
  el("f-focus-unit").value = String(profile.focusUnit);
  el("f-goal-minutes").value = profile.dailyGoalMinutes;
  el("f-place").value = profile.place;
  el("f-reward").value = profile.reward || "";

  el("subjects-list").innerHTML = "";
  profile.subjects.forEach((s) => el("subjects-list").appendChild(makeSubjectRow(s.name, s.weakness)));

  el("fixed-weekday-list").innerHTML = "";
  (profile.fixedBlocksWeekday || []).forEach((b) =>
    el("fixed-weekday-list").appendChild(makeFixedRow(b.name, b.start, b.end))
  );
  el("fixed-weekend-list").innerHTML = "";
  (profile.fixedBlocksWeekend || []).forEach((b) =>
    el("fixed-weekend-list").appendChild(makeFixedRow(b.name, b.start, b.end))
  );

  TRIGGERS.forEach((t) => {
    const cb = el(`trigger-${t.id}`);
    if (cb) cb.checked = (profile.triggers || []).includes(t.id);
  });
}

function readSubjectRows() {
  return [...el("subjects-list").querySelectorAll(".subject-row")].map((row, i) => ({
    id: `s${i}`,
    name: row.querySelector(".subj-name").value.trim() || `과목${i + 1}`,
    weakness: Number(row.querySelector(".subj-weakness").value),
  }));
}

function readFixedRows(containerId) {
  return [...el(containerId).querySelectorAll(".fixed-row")]
    .map((row) => ({
      name: row.querySelector(".fixed-name").value.trim(),
      start: row.querySelector(".fixed-start").value,
      end: row.querySelector(".fixed-end").value,
    }))
    .filter((b) => b.name && b.start && b.end);
}

function onSubmitOnboarding(e) {
  e.preventDefault();
  const subjects = readSubjectRows();
  if (subjects.length === 0) {
    alert("과목을 최소 1개는 추가해주세요.");
    return;
  }
  const triggers = TRIGGERS.filter((t) => el(`trigger-${t.id}`)?.checked).map((t) => t.id);

  const profile = {
    name: el("f-name").value.trim(),
    wake: el("f-wake").value,
    sleep: el("f-sleep").value,
    chronotype: el("f-chronotype").value,
    subjects,
    fixedBlocksWeekday: readFixedRows("fixed-weekday-list"),
    fixedBlocksWeekend: readFixedRows("fixed-weekend-list"),
    focusUnit: Number(el("f-focus-unit").value),
    dailyGoalMinutes: Number(el("f-goal-minutes").value) || 60,
    place: el("f-place").value.trim() || "내 책상",
    triggers,
    reward: el("f-reward").value.trim(),
  };

  storage.saveProfile(profile);
  renderApp();
  switchTab("today");
}

// ---------------- Tab switching ----------------

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== `tab-${tab}`));
  if (tab === "today") renderToday();
  if (tab === "review") renderReview();
  if (tab === "research") renderResearch();
}

function setupTabBar() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

// ---------------- Today tab ----------------

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function renderProgressCard(dateStr) {
  const progress = storage.getProgress();
  const level = levelFromXP(progress.totalXP);
  const curFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  const pct = Math.min(100, Math.round(((progress.totalXP - curFloor) / (nextFloor - curFloor)) * 100));

  el("stat-level").textContent = `Lv.${level}`;
  el("stat-xp").textContent = `${progress.totalXP} XP`;
  el("stat-streak").textContent = `${progress.streak}일`;
  el("xp-bar-fill").style.width = `${pct}%`;
  el("encourage-msg").textContent = ENCOURAGEMENTS[hashStr(dateStr) % ENCOURAGEMENTS.length];

  const badgeRow = el("badge-row");
  badgeRow.innerHTML = "";
  const stats = { ...progress, totalReviews: progress.totalReviews || 0 };
  BADGES.forEach((b) => {
    const unlocked = b.check(stats);
    const pill = document.createElement("span");
    pill.className = "badge-pill" + (unlocked ? "" : " locked");
    pill.textContent = b.label;
    badgeRow.appendChild(pill);
  });
}

function allPhasesForSessionDone(dateStr, session) {
  return PHASE_ORDER.every((p) => storage.isPhaseDone(dateStr, session.id, p));
}

function renderRewardCard(dateStr, schedule, profile) {
  const card = el("reward-card");
  if (!profile.reward) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const allDone = schedule.sessions.length > 0 && schedule.sessions.every((s) => allPhasesForSessionDone(dateStr, s));
  card.classList.toggle("locked", !allDone);
  card.classList.toggle("unlocked", allDone);
  card.innerHTML = allDone
    ? `<span class="icon">🎉</span> <div>열렸어요! 오늘의 보상: <strong>${profile.reward}</strong></div>`
    : `<span class="icon">🔒</span> <div>오늘 루틴을 모두 마치면 열려요: <strong>${profile.reward}</strong></div>`;
}

function renderTriggerTip(profile, dateStr) {
  const card = el("trigger-tip-card");
  if (!profile.triggers || profile.triggers.length === 0) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const pick = profile.triggers[hashStr(dateStr) % profile.triggers.length];
  card.innerHTML = `<strong>💡 오늘의 미루기 방지 팁</strong><p>${TRIGGER_TIPS[pick]}</p>`;
}

function stopActiveTimer() {
  if (activeTimer) {
    activeTimer.timer.stop();
    activeTimer = null;
  }
}

function renderToday() {
  const profile = storage.getProfile();
  const dateStr = storage.todayStr();
  const schedule = generateDaySchedule(profile, dateStr);

  const label = new Date(dateStr + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  el("today-date-label").textContent = `${label} (${schedule.dayType === "weekend" ? "주말" : "평일"}) 루틴`;

  renderProgressCard(dateStr);
  renderRewardCard(dateStr, schedule, profile);
  renderTriggerTip(profile, dateStr);

  const container = el("today-sessions");
  container.innerHTML = "";

  if (schedule.sessions.length === 0) {
    container.innerHTML = `<p class="empty-msg">오늘은 빈 시간이 부족해요. 설정에서 고정 일정이나 기상/취침 시간을 확인해보세요.</p>`;
  }

  schedule.sessions.forEach((session) => {
    container.appendChild(renderSessionCard(dateStr, session, profile));
  });

  container.appendChild(renderReviewSlotCard(dateStr, schedule.reviewSlot));
}

function renderSessionCard(dateStr, session, profile) {
  const card = document.createElement("div");
  card.className = "session-card";
  const done = allPhasesForSessionDone(dateStr, session);
  card.classList.toggle("done", done);

  const intention = `${session.startLabel}, ${profile.place}에서 ${session.subject.name} 공부를 시작해요.`;
  const atomicAction = ATOMIC_ACTIONS[session.index % ATOMIC_ACTIONS.length];

  card.innerHTML = `
    <div class="session-head">
      <span class="session-time">${session.startLabel} - ${session.endLabel}</span>
      <span class="session-subject">${session.subject.name}</span>
    </div>
    <p class="intention">📝 실행 의도: ${intention}</p>
    <div class="atomic-action">⚡ 시작 행동: ${atomicAction}</div>
    <ul class="phase-list"></ul>
  `;

  const list = card.querySelector(".phase-list");
  PHASE_ORDER.forEach((phaseKey) => {
    list.appendChild(renderPhaseRow(dateStr, session, phaseKey));
  });

  return card;
}

function renderPhaseRow(dateStr, session, phaseKey) {
  const li = document.createElement("li");
  const minutes = session.phases[phaseKey];
  const doneAlready = storage.isPhaseDone(dateStr, session.id, phaseKey);
  li.className = doneAlready ? "checked" : "";

  const isActive = activeTimer && activeTimer.sessionId === session.id && activeTimer.phaseKey === phaseKey;

  li.innerHTML = `
    <input type="checkbox" ${doneAlready ? "checked disabled" : ""} />
    <span>${PHASE_LABELS[phaseKey]}</span>
    <span class="phase-min">${minutes}분</span>
  `;

  if (!doneAlready) {
    const btn = document.createElement("button");
    btn.className = "secondary-btn small";
    btn.textContent = isActive ? "⏱ 진행중" : "▶ 시작";
    btn.disabled = isActive;
    btn.addEventListener("click", () => startPhaseTimer(dateStr, session, phaseKey, minutes));
    li.appendChild(btn);

    const doneBtn = document.createElement("button");
    doneBtn.className = "secondary-btn small";
    doneBtn.textContent = "완료로 표시";
    doneBtn.addEventListener("click", () => completePhase(dateStr, session, phaseKey, minutes));
    li.appendChild(doneBtn);
  }

  if (isActive) {
    const timerBox = document.createElement("div");
    timerBox.className = "timer-box";
    timerBox.innerHTML = `<div class="timer-display" id="timer-display-${session.id}-${phaseKey}">${formatSeconds(
      activeTimer.timer.remaining
    )}</div>`;
    li.appendChild(timerBox);
  }

  return li;
}

function startPhaseTimer(dateStr, session, phaseKey, minutes) {
  stopActiveTimer();
  const timer = new PhaseTimer({
    totalSeconds: minutes * 60,
    onTick: (remaining) => {
      const display = document.getElementById(`timer-display-${session.id}-${phaseKey}`);
      if (display) display.textContent = formatSeconds(remaining);
    },
    onComplete: () => {
      activeTimer = null;
      completePhase(dateStr, session, phaseKey, minutes);
    },
  });
  activeTimer = { sessionId: session.id, phaseKey, timer };
  timer.start();
  renderToday();
}

function completePhase(dateStr, session, phaseKey, minutes) {
  stopActiveTimer();
  const xp = minutes * XP_PER_MIN;
  storage.markPhaseDone(dateStr, session.id, phaseKey, xp);
  renderToday();
}

function renderReviewSlotCard(dateStr, reviewSlot) {
  const due = storage.dueTopics(dateStr);
  const card = document.createElement("div");
  card.className = "session-card";
  card.innerHTML = `
    <div class="session-head">
      <span class="session-time">${reviewSlot.startLabel} - ${reviewSlot.endLabel}</span>
      <span class="session-subject">🌙 취침 전 복습 슬롯</span>
    </div>
    <p class="intention">수면은 오늘 배운 걸 장기기억으로 옮기는 과정이에요. 자기 직전 가볍게 훑어보면 공고화 효율이 올라가요.</p>
    ${
      due.length > 0
        ? `<div class="atomic-action">오늘 복습할 개념 ${due.length}개가 '복습 퀘스트' 탭에 있어요.</div>`
        : `<div class="atomic-action">오늘 배운 내용을 눈 감고 1분간 떠올려보세요.</div>`
    }
  `;
  return card;
}

// ---------------- Review tab ----------------

function renderReview() {
  const dateStr = storage.todayStr();
  const due = el("review-due-list");
  due.innerHTML = "";
  const dueTopics = storage.dueTopics(dateStr);

  if (dueTopics.length === 0) {
    due.innerHTML = `<p class="empty-msg">오늘 복습할 항목이 없어요. 새 개념을 배우면 아래에서 등록해보세요.</p>`;
  }
  dueTopics.forEach((topic) => {
    const item = document.createElement("div");
    item.className = "review-item session-card";
    item.innerHTML = `
      <div>
        <div class="rname">${topic.name}</div>
        <div class="rsub">${topic.subject}</div>
      </div>
      <div>
        <button class="secondary-btn small" data-remember="1">기억났어요 ✅</button>
        <button class="secondary-btn small" data-remember="0">헷갈렸어요 🔁</button>
      </div>
    `;
    item.querySelectorAll("[data-remember]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const remembered = btn.dataset.remember === "1";
        storage.reviewTopic(topic.id, remembered, dateStr);
        if (remembered) storage.addXP(10, dateStr);
        renderReview();
      });
    });
    due.appendChild(item);
  });

  const profile = storage.getProfile();
  const subjectSelect = el("topic-subject");
  subjectSelect.innerHTML = profile.subjects.map((s) => `<option value="${s.name}">${s.name}</option>`).join("");

  const allList = el("topic-all-list");
  allList.innerHTML = "";
  const all = [...storage.getSrsQueue()].sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  if (all.length === 0) {
    allList.innerHTML = `<p class="empty-msg">아직 등록된 개념이 없어요.</p>`;
  }
  all.forEach((t) => {
    const row = document.createElement("div");
    row.className = "topic-card";
    row.innerHTML = `
      <div>
        <div class="rname">${t.name} ${t.mastered ? "🏆" : ""}</div>
        <div class="rsub">${t.subject} · 다음 복습: ${t.nextDue}</div>
      </div>
    `;
    allList.appendChild(row);
  });
}

function setupReviewForm() {
  el("topic-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const subject = el("topic-subject").value;
    const name = el("topic-name").value.trim();
    if (!name) return;
    storage.addTopic(subject, name, storage.todayStr());
    el("topic-name").value = "";
    renderReview();
  });
}

// ---------------- Research tab ----------------

function renderResearch() {
  const list = el("research-list");
  list.innerHTML = "";
  RESEARCH.forEach((r) => {
    const card = document.createElement("div");
    card.className = "research-card";
    card.innerHTML = `
      <h3>${r.title}</h3>
      <p>${r.mechanism}</p>
      <div class="applied">🔧 이 앱에서: ${r.applied}</div>
      <div class="source">출처: ${r.source}</div>
    `;
    list.appendChild(card);
  });
}

// ---------------- Settings tab ----------------

function setupSettings() {
  el("redo-onboarding-btn").addEventListener("click", () => {
    const profile = storage.getProfile();
    if (profile) fillOnboardingFromProfile(profile);
    else fillOnboardingDefaults();
    el("tab-bar").hidden = true;
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
    el("onboarding").hidden = false;
    window.scrollTo(0, 0);
  });

  el("export-btn").addEventListener("click", () => {
    const data = storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-routine-backup-${storage.todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  el("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        storage.importAll(data);
        renderApp();
        switchTab("today");
        alert("불러오기가 완료됐어요.");
      } catch (err) {
        alert("파일을 읽는 데 실패했어요. 올바른 백업 파일인지 확인해주세요.");
      }
    };
    reader.readAsText(file);
  });

  el("reset-btn").addEventListener("click", () => {
    if (confirm("정말 모든 데이터를 초기화할까요? 되돌릴 수 없어요.")) {
      storage.resetAll();
      location.reload();
    }
  });
}

// ---------------- App bootstrap ----------------

function renderApp() {
  const profile = storage.getProfile();
  if (!profile) {
    el("tab-bar").hidden = true;
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
    el("onboarding").hidden = false;
    fillOnboardingDefaults();
  } else {
    el("onboarding").hidden = true;
    el("tab-bar").hidden = false;
    switchTab("today");
  }
}

setupOnboardingStatic();
setupTabBar();
setupReviewForm();
setupSettings();
renderApp();
