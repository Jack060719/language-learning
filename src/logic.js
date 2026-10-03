export const ERROR_CATEGORIES = [
  'Vocabulary', 'Grammar', 'Verb Conjugation', 'Gender', 'Articles',
  'Prepositions', 'Word Order', 'Pronunciation', 'Spelling', 'Natural Expression',
];

const LEVELS = ['A1', 'A2', 'B1'];
const GAP_DAYS = [0, 1, 2, 4, 7, 16, 30];
const ITEM_KINDS = ['vocabulary', 'grammar', 'pattern'];
const RESULTS = ['introduced', 'correct', 'incorrect'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value, min = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function requireField(condition, message) {
  if (!condition) throw new Error(message);
}

export function taipeiDay(value) {
  const date = new Date(value);
  requireField(!Number.isNaN(date.getTime()), '日期不是有效的 ISO 8601 時間。');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (name) => parts.find((part) => part.type === name).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(day, count) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function assessmentStatus(payload) {
  const reasons = [];
  const scores = payload.scores || {};
  const values = ['listening', 'reading', 'spoken_interaction', 'spoken_production', 'writing']
    .map((key) => scores[key]);
  if (values.some((score) => !Number.isInteger(score) || score < 0 || score > 4)) {
    reasons.push('五項能力分數須各為 0–4。');
  } else {
    if (values.some((score) => score < 3)) reasons.push('每項能力須至少 3 分。');
    if (values.reduce((sum, score) => sum + score, 0) < 17) reasons.push('五項合計須至少 17 分。');
  }
  if (!isNumber(payload.listening_pct) || payload.listening_pct < 75 || payload.listening_pct > 100) reasons.push('聽力理解須至少 75%。');
  if (!isNumber(payload.reading_pct) || payload.reading_pct < 75 || payload.reading_pct > 100) reasons.push('閱讀理解須至少 75%。');
  if (payload.audio_played !== true) reasons.push('尚無實際音訊聽力證據。');
  if (payload.voice_evaluated !== true) reasons.push('尚無實際語音互動證據。');
  const minMinutes = { A1: 3, A2: 6, B1: 10 }[payload.level];
  if (!isNumber(payload.conversation_minutes) || payload.conversation_minutes < minMinutes) reasons.push(`對話需至少 ${minMinutes} 分鐘。`);
  if (payload.essential_tasks_passed !== true) reasons.push('本級必要情境任務尚未全數完成。');
  return { passed: reasons.length === 0, reasons };
}

export function validateEvent(input) {
  requireField(input && typeof input === 'object' && !Array.isArray(input), '批改包必須是 JSON 物件。');
  requireField(input.schema_version === 1, 'schema_version 必須是 1。');
  requireField(isText(input.event_id) && uuid.test(input.event_id), 'event_id 必須是 UUID。');
  requireField(['lesson', 'review', 'assessment'].includes(input.event_type), 'event_type 不正確。');
  requireField(isText(input.occurred_at) && !Number.isNaN(Date.parse(input.occurred_at)), 'occurred_at 必須是日期時間。');
  const p = input.payload;
  requireField(p && typeof p === 'object' && !Array.isArray(p), 'payload 必須是物件。');
  requireField(['es', 'it'].includes(p.language), 'language 必須是 es 或 it。');
  if (input.event_type === 'assessment') {
    requireField(LEVELS.includes(p.level), '評量 level 必須是 A1、A2 或 B1。');
    requireField(p.scores && typeof p.scores === 'object', '評量缺少 scores。');
    for (const key of ['listening', 'reading', 'spoken_interaction', 'spoken_production', 'writing']) {
      requireField(Number.isInteger(p.scores[key]) && p.scores[key] >= 0 && p.scores[key] <= 4, `scores.${key} 須為 0–4。`);
    }
    for (const key of ['listening_pct', 'reading_pct']) {
      requireField(isNumber(p[key]) && p[key] <= 100, `${key} 須為 0–100。`);
    }
    requireField(typeof p.audio_played === 'boolean' && typeof p.voice_evaluated === 'boolean', '請標示實際音訊及語音證據。');
    requireField(isNumber(p.conversation_minutes), 'conversation_minutes 須為非負數。');
    requireField(typeof p.essential_tasks_passed === 'boolean', '請標示必要情境任務是否通過。');
    return input;
  }
  requireField(Array.isArray(p.items), 'payload.items 必須是陣列。');
  if (input.event_type === 'lesson') {
    requireField(isText(p.lesson_id) && /^(es|it)-(A1|A2|B1)-/.test(p.lesson_id), 'lesson_id 格式須如 es-A1-01-L01。');
    requireField(p.lesson_id.startsWith(`${p.language}-`), 'lesson_id 語言與 language 不一致。');
    requireField(['daily', 'intensive', 'maintenance', 'review'].includes(p.mode), 'mode 不正確。');
    for (const key of ['duration_minutes', 'listening_minutes', 'speaking_sessions', 'writing_sessions']) {
      requireField(isNumber(p[key]), `${key} 須為非負數。`);
    }
    requireField(typeof p.output_passed === 'boolean', 'output_passed 須標示當課輸出是否達標。');
    requireField(Array.isArray(p.corrections), 'payload.corrections 必須是陣列。');
  }
  for (const item of p.items) {
    requireField(isText(item.id) && isText(item.front) && isText(item.back), '複習項需有 id、front、back。');
    requireField(ITEM_KINDS.includes(item.kind), `項目 ${item.id} 的 kind 不正確。`);
    requireField(RESULTS.includes(item.result), `項目 ${item.id} 的 result 不正確。`);
    if (input.event_type === 'review') requireField(item.result !== 'introduced', '複習結果只能是 correct 或 incorrect。');
    if (item.error_category !== undefined) requireField(ERROR_CATEGORIES.includes(item.error_category), `項目 ${item.id} 的錯誤類別不正確。`);
  }
  for (const correction of p.corrections || []) {
    requireField(isText(correction.original) && isText(correction.corrected) && isText(correction.reason), '逐句批改須有 original、corrected、reason。');
    requireField(ERROR_CATEGORIES.includes(correction.category), '逐句批改的 category 不正確。');
  }
  return input;
}

export function canRecordEvent(event, state) {
  const { language } = event.payload;
  if (language === 'it' && !state.passed.es.includes('B1')) return '西班牙文 B1 尚未通過，義文課程仍鎖定。';
  const target = event.event_type === 'assessment'
    ? event.payload.level
    : event.event_type === 'lesson' ? event.payload.lesson_id.split('-')[1] : null;
  if (target) {
    const index = LEVELS.indexOf(target);
    if (index > 0 && !state.passed[language].includes(LEVELS[index - 1])) return `${language.toUpperCase()} ${LEVELS[index - 1]} 尚未通過。`;
  }
  return null;
}

export function buildState(events, now = new Date()) {
  const sorted = [...events].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const passed = { es: [], it: [] };
  const cards = new Map();
  const errors = new Map();
  const lessonIds = new Set();
  const grammarIds = new Set();
  const vocabIds = new Set();
  const assessments = [];
  const lessons = [];
  let listeningMinutes = 0;
  let speakingSessions = 0;
  let writingSessions = 0;
  let reviewCorrect = 0;
  let reviewTotal = 0;
  const today = taipeiDay(now);
  const thirtyDaysAgo = addDays(today, -30);

  for (const event of sorted) {
    const p = event.payload;
    const day = taipeiDay(event.occurred_at);
    if (event.event_type === 'assessment') {
      const status = assessmentStatus(p);
      assessments.push({ ...event, status });
      const expected = LEVELS[passed[p.language].length];
      if (status.passed && p.level === expected && (p.language === 'es' || passed.es.includes('B1'))) passed[p.language].push(p.level);
      continue;
    }
    if (event.event_type === 'lesson') {
      lessonIds.add(p.lesson_id);
      lessons.push(event);
      listeningMinutes += p.listening_minutes;
      speakingSessions += p.speaking_sessions;
      writingSessions += p.writing_sessions;
      for (const correction of p.corrections) {
        const key = `${p.language}:${correction.category}:${correction.error_key || correction.corrected}`;
        const entry = errors.get(key) || { language: p.language, category: correction.category, original: correction.original, corrected: correction.corrected, reason: correction.reason, natural: correction.natural || '', first: day, count: 0, sessions: new Set(), improvementSessions: new Set() };
        entry.count++;
        entry.last = day;
        entry.sessions.add(event.event_id);
        entry.improvementSessions.clear();
        errors.set(key, entry);
      }
    }
    for (const item of p.items) {
      if (item.kind === 'vocabulary') vocabIds.add(`${p.language}:${item.id}`);
      if (item.kind === 'grammar') grammarIds.add(`${p.language}:${item.id}`);
      const key = `${p.language}:${item.id}`;
      const card = cards.get(key) || { ...item, language: p.language, first_learned: day, stage: 0, next_due: day, wrong_count: 0, ever_wrong: false, last_reviewed: null, archived: false, mistakes: [] };
      card.front = item.front;
      card.back = item.back;
      if (item.result === 'correct') {
        if (!card.archived) {
          if (card.stage === 6) {
            card.archived = true;
            card.next_due = null;
          } else {
            card.stage++;
            card.next_due = addDays(day, GAP_DAYS[card.stage]);
          }
        }
        card.last_reviewed = day;
        if (item.error_key && item.error_category) {
          const entry = errors.get(`${p.language}:${item.error_category}:${item.error_key}`);
          if (entry && !entry.sessions.has(event.event_id)) entry.improvementSessions.add(event.event_id);
        }
      } else if (item.result === 'incorrect') {
        card.stage = 0;
        card.archived = false;
        card.next_due = addDays(day, 1);
        card.last_reviewed = day;
        card.wrong_count++;
        card.ever_wrong = true;
        if (item.mistake) card.mistakes.push(item.mistake);
        if (item.error_category) {
          const errorKey = `${p.language}:${item.error_category}:${item.error_key || item.id}`;
          const entry = errors.get(errorKey) || { language: p.language, category: item.error_category, original: item.mistake || item.front, corrected: item.back, reason: '複習時答錯，需重新回想。', natural: '', first: day, count: 0, sessions: new Set(), improvementSessions: new Set() };
          entry.count++;
          entry.last = day;
          entry.sessions.add(event.event_id);
          entry.improvementSessions.clear();
          errors.set(errorKey, entry);
        }
      }
      cards.set(key, card);
      if (event.event_type === 'review' && day >= thirtyDaysAgo && item.result !== 'introduced') {
        reviewTotal++;
        if (item.result === 'correct') reviewCorrect++;
      }
    }
  }

  const due = [...cards.values()].filter((card) => !card.archived && card.next_due <= today).sort((a, b) => a.next_due.localeCompare(b.next_due));
  const errorList = [...errors.values()].map((entry) => ({ ...entry, session_count: entry.sessions.size, status: entry.improvementSessions.size >= 2 ? '已改善' : entry.count >= 3 && entry.sessions.size >= 2 ? '需補強' : '觀察中' })).sort((a, b) => b.count - a.count);
  const language = passed.es.includes('B1') ? 'it' : 'es';
  const level = LEVELS[passed[language].length] || 'B1';
  const recent = lessons.slice(-2).map((event) => {
    const answered = event.payload.items.filter((item) => item.result !== 'introduced');
    return { accuracy: answered.length ? answered.filter((item) => item.result === 'correct').length / answered.length : null, output_passed: event.payload.output_passed === true };
  });
  let guidance = '先完成到期複習，再依課程地圖學習。';
  if (due.length && due[0].next_due < addDays(today, -7)) guidance = '進入 Review Mode：先補過期複習，暫停新文法。';
  else if (recent.length === 2 && recent.every((item) => item.accuracy !== null && item.accuracy < 0.6)) guidance = '最近兩次低於 60%：降低難度並補教。';
  else if (errorList.some((item) => item.status === '需補強')) guidance = '下課先安排常錯結構的專項補強。';
  else if (recent.length === 2 && recent.every((item) => item.accuracy !== null && item.accuracy >= 0.85 && item.output_passed)) guidance = '最近兩次穩定達標：下一課可小幅增加自由輸出。';

  return {
    passed, language, level, cards: [...cards.values()], due, errors: errorList, assessments,
    lessonCount: lessonIds.size, vocabularyCount: vocabIds.size, grammarCount: grammarIds.size,
    listeningHours: +(listeningMinutes / 60).toFixed(1), speakingSessions, writingSessions,
    reviewAccuracy: reviewTotal ? Math.round(reviewCorrect / reviewTotal * 100) : null,
    guidance,
  };
}
