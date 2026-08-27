const KEYS = {
  profile: "sr_profile_v1",
  log: "sr_log_v1",
  srs: "sr_srs_v1",
  progress: "sr_progress_v1",
};

export const SRS_INTERVALS = [1, 3, 7, 16];

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

// ---- Profile ----
export function getProfile() {
  return read(KEYS.profile, null);
}
export function saveProfile(profile) {
  write(KEYS.profile, profile);
}

// ---- Daily log (session completion, per date) ----
export function getLog() {
  return read(KEYS.log, {});
}
export function getDayLog(dateStr) {
  const log = getLog();
  return log[dateStr] || { sessions: {}, dailyComplete: false };
}
export function setDayLog(dateStr, dayLog) {
  const log = getLog();
  log[dateStr] = dayLog;
  write(KEYS.log, log);
}
export function markPhaseDone(dateStr, sessionId, phaseKey, xp) {
  const dayLog = getDayLog(dateStr);
  if (!dayLog.sessions[sessionId]) dayLog.sessions[sessionId] = {};
  const already = !!dayLog.sessions[sessionId][phaseKey];
  dayLog.sessions[sessionId][phaseKey] = true;
  setDayLog(dateStr, dayLog);
  if (!already) addXP(xp, dateStr);
  return !already;
}
export function isPhaseDone(dateStr, sessionId, phaseKey) {
  const dayLog = getDayLog(dateStr);
  return !!(dayLog.sessions[sessionId] && dayLog.sessions[sessionId][phaseKey]);
}

// ---- SRS queue ----
export function getSrsQueue() {
  return read(KEYS.srs, []);
}
export function saveSrsQueue(queue) {
  write(KEYS.srs, queue);
}
export function addTopic(subject, name, dateStr) {
  const queue = getSrsQueue();
  const topic = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subject,
    name,
    studiedDate: dateStr,
    stage: 0,
    nextDue: addDays(dateStr, SRS_INTERVALS[0]),
    mastered: false,
  };
  queue.push(topic);
  saveSrsQueue(queue);
  return topic;
}
export function reviewTopic(id, remembered, dateStr) {
  const queue = getSrsQueue();
  const topic = queue.find((t) => t.id === id);
  if (!topic) return;
  if (remembered) {
    if (topic.stage >= SRS_INTERVALS.length - 1) {
      topic.mastered = true;
    } else {
      topic.stage += 1;
      topic.nextDue = addDays(dateStr, SRS_INTERVALS[topic.stage]);
    }
    incrementReviewCount();
  } else {
    topic.stage = 0;
    topic.nextDue = addDays(dateStr, SRS_INTERVALS[0]);
  }
  saveSrsQueue(queue);
}
export function dueTopics(dateStr) {
  return getSrsQueue().filter((t) => !t.mastered && t.nextDue <= dateStr);
}

// ---- Progress (XP / streak / badges) ----
export function getProgress() {
  return read(KEYS.progress, {
    totalXP: 0,
    lastStudyDate: null,
    streak: 0,
    totalSessions: 0,
    totalReviews: 0,
    unlockedBadges: [],
  });
}
export function saveProgress(progress) {
  write(KEYS.progress, progress);
}
export function addXP(amount, dateStr) {
  const progress = getProgress();
  progress.totalXP += amount;
  if (progress.lastStudyDate !== dateStr) {
    const yesterday = addDays(dateStr, -1);
    progress.streak = progress.lastStudyDate === yesterday ? progress.streak + 1 : 1;
    progress.lastStudyDate = dateStr;
    progress.totalSessions += 1;
  }
  saveProgress(progress);
  return progress;
}
export function incrementReviewCount() {
  const progress = getProgress();
  progress.totalReviews = (progress.totalReviews || 0) + 1;
  saveProgress(progress);
}

// ---- Export / Import / Reset ----
export function exportAll() {
  return {
    profile: getProfile(),
    log: getLog(),
    srs: getSrsQueue(),
    progress: getProgress(),
    exportedAt: new Date().toISOString(),
  };
}
export function importAll(data) {
  if (data.profile) write(KEYS.profile, data.profile);
  if (data.log) write(KEYS.log, data.log);
  if (data.srs) write(KEYS.srs, data.srs);
  if (data.progress) write(KEYS.progress, data.progress);
}
export function resetAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
