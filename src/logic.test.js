import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, assessmentStatus, buildState, canRecordEvent, validateEvent } from './logic.js';

const date = (day) => `${day}T10:00:00+08:00`;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (result) => ({ id: 'es-A1-01-v01', kind: 'vocabulary', front: '你好？', back: 'Hola.', result });
const lesson = (n, day, result = 'introduced') => ({
  schema_version: 1, event_id: id(n), event_type: 'lesson', occurred_at: date(day),
  payload: { language: 'es', lesson_id: `es-A1-01-L0${n}`, mode: 'daily', duration_minutes: 40,
    listening_minutes: 10, speaking_sessions: 1, writing_sessions: 1, output_passed: true,
    items: [item(result)], corrections: [] },
});
const review = (n, day, result) => ({ schema_version: 1, event_id: id(n), event_type: 'review', occurred_at: date(day), payload: { language: 'es', items: [item(result)] } });
const assessment = (n, day, language, level, overrides = {}) => ({ schema_version: 1, event_id: id(n), event_type: 'assessment', occurred_at: date(day), payload: {
  language, level, scores: { listening: 4, reading: 4, spoken_interaction: 3, spoken_production: 3, writing: 3 },
  listening_pct: 80, reading_pct: 80, audio_played: true, voice_evaluated: true,
  conversation_minutes: level === 'B1' ? 12 : 6, essential_tasks_passed: true, ...overrides,
} });

test('review schedule reaches Day 60 and archives after successful recall', () => {
  const days = ['2026-10-04', '2026-10-05', '2026-10-07', '2026-10-11', '2026-10-18', '2026-11-03', '2026-12-03'];
  const events = [lesson(1, days[0], 'correct')];
  const due = ['2026-10-05', '2026-10-07', '2026-10-11', '2026-10-18', '2026-11-03', '2026-12-03'];
  for (let i = 0; i < due.length; i++) {
    assert.equal(buildState(events, new Date(date(days[i]))).cards[0].next_due, due[i]);
    events.push(review(i + 2, days[i + 1], 'correct'));
  }
  assert.equal(buildState(events, new Date(date('2026-12-04'))).cards[0].archived, true);
});

test('incorrect recall returns card to tomorrow and records the error', () => {
  const events = [lesson(1, '2026-10-04', 'correct'), review(2, '2026-10-05', 'incorrect')];
  const card = buildState(events, new Date(date('2026-10-05'))).cards[0];
  assert.equal(card.next_due, '2026-10-06');
  assert.equal(card.stage, 0);
  assert.equal(card.ever_wrong, true);
  assert.equal(card.wrong_count, 1);
});

test('late successful reviews schedule from the actual review day', () => {
  const state = buildState([lesson(1, '2026-10-04', 'correct'), review(2, '2026-10-10', 'correct')], new Date(date('2026-10-10')));
  assert.equal(state.cards[0].next_due, '2026-10-12');
});

test('assessment requires every skill and actual audio evidence', () => {
  const good = assessment(1, '2026-10-04', 'es', 'B1').payload;
  assert.equal(assessmentStatus(good).passed, true);
  assert.equal(assessmentStatus({ ...good, voice_evaluated: false }).passed, false);
  assert.equal(assessmentStatus({ ...good, scores: { ...good.scores, reading: 2 } }).passed, false);
  assert.equal(assessmentStatus({ ...good, conversation_minutes: 9 }).passed, false);
});

test('Italian is locked until Spanish B1 passes in sequence', () => {
  const italian = lesson(9, '2026-10-04');
  italian.payload.language = 'it'; italian.payload.lesson_id = 'it-A1-01-L01';
  assert.match(canRecordEvent(italian, buildState([])), /西班牙文 B1/);
  const pass = [assessment(1, '2026-10-04', 'es', 'A1'), assessment(2, '2026-10-05', 'es', 'A2'), assessment(3, '2026-10-06', 'es', 'B1')];
  assert.equal(canRecordEvent(italian, buildState(pass)), null);
  assert.equal(buildState(pass).language, 'it');
});

test('record validation catches malformed feedback and phase jumps', () => {
  assert.equal(validateEvent(lesson(1, '2026-10-04')).event_type, 'lesson');
  assert.throws(() => validateEvent({ ...lesson(1, '2026-10-04'), event_id: 'bad' }), /UUID/);
  const advanced = lesson(2, '2026-10-04'); advanced.payload.lesson_id = 'es-A2-01-L01';
  assert.match(canRecordEvent(advanced, buildState([])), /A1/);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('repeated structure errors become a weakness and later correct practice clears it', () => {
  const events = [lesson(1, '2026-10-01'), lesson(2, '2026-10-02')];
  events[0].payload.corrections = [
    { original: 'Yo es Ana.', corrected: 'Soy Ana.', reason: '第一人稱用 soy。', category: 'Verb Conjugation', error_key: 'ser-first-person' },
    { original: 'Yo es Lee.', corrected: 'Soy Lee.', reason: '第一人稱用 soy。', category: 'Verb Conjugation', error_key: 'ser-first-person' },
  ];
  events[1].payload.corrections = [{ original: 'Es Carlos.', corrected: 'Soy Carlos.', reason: '第一人稱用 soy。', category: 'Verb Conjugation', error_key: 'ser-first-person' }];
  assert.equal(buildState(events, new Date(date('2026-10-02'))).errors[0].status, '需補強');
  for (const [n, day] of [[3, '2026-10-03'], [4, '2026-10-04']]) {
    const practice = review(n, day, 'correct');
    practice.payload.items[0].error_key = 'ser-first-person';
    practice.payload.items[0].error_category = 'Verb Conjugation';
    events.push(practice);
  }
  assert.equal(buildState(events, new Date(date('2026-10-04'))).errors[0].status, '已改善');
});
