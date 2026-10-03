import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import './style.css';
import readme from '../README.md?raw';
import roadmap from '../ROADMAP.md?raw';
import spanish from '../maps/spanish.md?raw';
import italian from '../maps/italian.md?raw';
import record from '../system/learning-record.md?raw';
import errorsDoc from '../system/error-log.md?raw';
import reviewDoc from '../system/review.md?raw';
import assessmentDoc from '../system/assessment.md?raw';
import { assessmentStatus, buildState, canRecordEvent, validateEvent } from './logic.js';

const docs = { readme, roadmap, spanish, italian, record, 'error-log': errorsDoc, 'review-system': reviewDoc, 'assessment-system': assessmentDoc };
const titles = { readme: '使用說明', roadmap: '總體路線', spanish: '西文課程地圖', italian: '義文課程地圖', record: '學習紀錄格式', 'error-log': 'Error Log 規則', 'review-system': '複習系統規則', 'assessment-system': 'CEFR 評量規則' };
const app = document.querySelector('#app');
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key) : null;
let user = null;
let events = [];
let state = buildState(events);
let notice = '';
let revealedCard = null;
let ttsText = '';
let ttsHidden = false;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const label = (lang) => lang === 'es' ? '西班牙文' : '義大利文';
const day = (value) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const route = () => (location.hash.slice(1) || 'home').split('?')[0];

function linkedMarkdown(source) {
  const links = {
    'ROADMAP.md': '#roadmap', 'maps/spanish.md': '#spanish', 'maps/italian.md': '#italian',
    'system/learning-record.md': '#record', 'system/error-log.md': '#error-log',
    'system/review.md': '#review-system', 'system/assessment.md': '#assessment-system',
    'assessment.md': '#assessment-system', 'review.md': '#review-system',
    'supabase/schema.sql': 'https://github.com/Jack060719/language-learning/blob/main/supabase/schema.sql',
  };
  return marked.parse(source).replace(/href="([^"]+)"/g, (full, href) => `href="${links[href] || href}"`);
}

function navLink(name, target) {
  return `<a class="nav-link ${route() === target ? 'active' : ''}" href="#${target}">${name}</a>`;
}

function shell(body) {
  const account = !client ? '<span class="account-note">同步尚未設定</span>' : user ? `<span class="account-note">${escapeHtml(user.email)}</span><button class="text-button" id="sign-out">登出</button>` : '<a class="account-link" href="#setup">登入同步</a>';
  app.innerHTML = `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" href="#home"><span class="brand-mark">語</span><span><strong>語路</strong><small>Language learning system</small></span></a>
        <div class="account">${account}</div>
      </header>
      <nav class="navigation" aria-label="主要導覽">
        ${navLink('儀表板', 'home')}${navLink('課程地圖', 'roadmap')}${navLink('學習紀錄', 'study')}${navLink('到期複習', 'review')}${navLink('錯誤追蹤', 'errors')}${navLink('關卡', 'assessment')}${navLink('設定', 'setup')}
      </nav>
      <main>${notice ? `<div class="notice" role="status">${escapeHtml(notice)}</div>` : ''}${body}</main>
      <footer>理解 → 回想 → 輸出 → 複習 <span>·</span> 西文 B1 通過後才開始義文</footer>
    </div>`;
  document.querySelector('#sign-out')?.addEventListener('click', async () => {
    await client.auth.signOut();
    user = null; events = []; state = buildState(events); notice = '已登出。'; render();
  });
}

function metric(value, caption) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${caption}</span></div>`;
}

function homePage() {
  const active = `${label(state.language)} ${state.level}`;
  const accuracy = state.reviewAccuracy === null ? '尚無資料' : `${state.reviewAccuracy}%`;
  const weakness = state.errors.find((entry) => entry.status !== '已改善');
  const dataReady = user ? '' : '<div class="inline-hint">登入後顯示跨裝置同步的個人紀錄。目前數值為新學習者起點。</div>';
  return `<section class="hero"><div><p class="eyebrow">長期語言學習專案</p><h1>一步一步，<br><em>學到能使用。</em></h1><p>先建立穩定的西班牙文 B1，再透過橋接開始義大利文。進度由實際理解和輸出決定。</p><div class="hero-actions"><a class="button" href="#roadmap">查看課程地圖</a><a class="button secondary" href="#study">記錄學習</a></div></div><div class="phase-card"><span>目前階段</span><strong>${active}</strong><p>${state.passed.es.includes('B1') ? '西文維持課持續進行；義文已解鎖。' : '義文尚未解鎖。先穩固西文。'}</p><div class="phase-line"><i></i><i></i><i></i></div></div></section>
    ${dataReady}<section class="section-heading"><div><p class="eyebrow">學習儀表板</p><h2>能力的證據</h2></div><span>Asia/Taipei · 最近複習依 30 天計</span></section>
    <div class="metrics">${metric(state.lessonCount, 'Lessons Completed')}${metric(state.vocabularyCount, 'Vocabulary Learned')}${metric(state.grammarCount, 'Grammar Topics')}${metric(state.listeningHours, 'Listening Hours')}${metric(state.speakingSessions, 'Speaking Sessions')}${metric(state.writingSessions, 'Writing Sessions')}${metric(accuracy, 'Review Accuracy')}${metric(state.due.length, '到期複習')}</div>
    <div class="two-column"><article class="panel"><p class="eyebrow">下一步</p><h3>${escapeHtml(active)}</h3><p>${escapeHtml(state.guidance)}</p><a class="inline-link" href="#review">查看到期項 →</a></article><article class="panel"><p class="eyebrow">目前弱點</p><h3>${weakness ? escapeHtml(weakness.category) : '尚無待補強錯誤'}</h3><p>${weakness ? `${escapeHtml(weakness.corrected)} · 累積 ${weakness.count} 次` : '開始上課並匯入批改後，這裡會顯示反覆出現的錯誤。'}</p><a class="inline-link" href="#errors">查看 Error Log →</a></article></div>
    <section class="intro-strip"><span>01 · 西文 A1</span><span>02 · 西文 A2</span><span>03 · 西文 B1</span><span>04 · 維持＋義文橋接</span><span>05 · 義文 A1–B1</span></section>`;
}

function roadmapPage() {
  return `<section class="page-title"><p class="eyebrow">課程路線</p><h1>先西文，再義文。</h1><p>每個階段需完成聽、讀、說、寫關卡；課次與單字數只是學習記錄。</p></section>
    <div class="map-links"><a class="map-tile" href="#spanish"><span>01 — 04</span><h2>Español</h2><p>零基礎 → A1 → A2 → B1 → 維持</p><b>查看西文地圖 ↗</b></a><a class="map-tile italian ${state.passed.es.includes('B1') ? '' : 'locked'}" href="#italian"><span>05 — 07 ${state.passed.es.includes('B1') ? '' : '· 課程鎖定'}</span><h2>Italiano</h2><p>橋接 → A1 → A2 → B1</p><b>查看義文規劃 ↗</b></a></div>
    <article class="document">${linkedMarkdown(roadmap)}</article>`;
}

function studyPage() {
  return `<section class="page-title"><p class="eyebrow">課後回寫</p><h1>把練習變成紀錄。</h1><p>Codex 負責批改；網站保存批改結果、安排複習與追蹤弱點。</p></section>
    <div class="two-column"><article class="panel"><p class="eyebrow">Step 1</p><h2>複製作答給 Codex</h2><label>課次 ID<input id="lesson-id" value="${state.language}-${state.level}-01-L01" /></label><label>我的原始作答<textarea id="raw-answers" rows="7" placeholder="貼上本課理解題、口說逐字稿或寫作。錄音請另外附給 Codex。"></textarea></label><button class="button" id="copy-request">複製紀錄請求</button><p class="small-note">網站只包裝作答，不會自行判斷語法或口音。</p></article>
    <article class="panel"><p class="eyebrow">Step 2</p><h2>貼回批改包</h2><label>Codex 回傳的 LearningEvent v1 JSON<textarea id="feedback-json" rows="10" placeholder='{"schema_version":1,"event_id":"…","event_type":"lesson","occurred_at":"…","payload":{…}}'></textarea></label><button class="button" id="save-feedback" ${user ? '' : 'disabled'}>驗證並儲存</button><p class="small-note">${user ? '儲存成功後才會更新進度。' : '先登入才能同步與儲存。'}</p></article></div>
    <article class="panel tts-panel"><div><p class="eyebrow">聽力工具</p><h2>先聽，再看逐字稿</h2><p>貼入本課的自然文本。啟動只聽模式後，文字會隱藏；回答後再揭示。</p></div><div><label>音訊文本<textarea id="tts-text" rows="4" ${ttsHidden ? 'class="hidden-transcript"' : ''} placeholder="由 Codex 提供符合目前程度的西文或義文文本">${escapeHtml(ttsText)}</textarea></label><div class="button-row"><button class="button secondary" id="play-tts">播放並隱藏文本</button><button class="text-button" id="reveal-tts">揭示文本</button></div></div></article>
    <div class="doc-shortcuts"><a href="#record">查看紀錄格式 →</a><a href="#review-system">查看複習規則 →</a></div>`;
}

function reviewPage() {
  const intro = `<section class="page-title"><p class="eyebrow">Spaced Repetition</p><h1>今天，試著想起來。</h1><p>先看提示回想，再揭示答案並誠實記錄。答錯項明天再出現。</p></section>`;
  if (!user) return intro + '<div class="empty-state">登入後會載入你的到期複習卡。<a href="#setup">前往設定 →</a></div>';
  if (!state.due.length) return intro + '<div class="empty-state">目前沒有到期項。請依課程地圖繼續學習，或閱讀複習規則。<a href="#review-system">複習規則 →</a></div>';
  const cards = state.due.slice(0, 8).map((card) => {
    const cardKey = `${card.language}:${card.id}`;
    return `<article class="review-card"><div class="card-top"><span>${label(card.language)} · ${escapeHtml(card.kind)}</span><span>到期 ${escapeHtml(card.next_due)}</span></div><h3>${escapeHtml(card.front)}</h3>${revealedCard === cardKey ? `<div class="answer"><span>回想答案</span><p>${escapeHtml(card.back)}</p></div><div class="button-row"><button class="button secondary review-result" data-key="${escapeHtml(cardKey)}" data-result="incorrect">還不會</button><button class="button review-result" data-key="${escapeHtml(cardKey)}" data-result="correct">想起來了</button></div>` : `<button class="button secondary reveal-card" data-key="${escapeHtml(cardKey)}">揭示答案</button>`}</article>`;
  }).join('');
  return intro + `<div class="review-summary"><strong>${state.due.length}</strong><span>項到期 · 每次先做少量，維持回想品質</span></div><div class="review-grid">${cards}</div>`;
}

function errorsPage() {
  const rows = state.errors.map((entry) => `<article class="error-entry"><div><span class="category">${escapeHtml(entry.category)}</span><span class="status">${entry.status}</span></div><h3>${escapeHtml(entry.original)}</h3><p><strong>修正：</strong>${escapeHtml(entry.corrected)}</p><p><strong>原因：</strong>${escapeHtml(entry.reason)}</p>${entry.natural ? `<p><strong>更自然：</strong>${escapeHtml(entry.natural)}</p>` : ''}<small>${label(entry.language)} · ${entry.count} 次 · 最近 ${escapeHtml(entry.last)}</small></article>`).join('');
  return `<section class="page-title"><p class="eyebrow">Error Log</p><h1>看見反覆的問題。</h1><p>錯誤按類別與結構聚合；跨工作階段重複三次的問題會優先補強。</p></section>${user ? rows ? `<div class="error-list">${rows}</div>` : '<div class="empty-state">目前沒有需追蹤的錯誤。</div>' : '<div class="empty-state">登入後顯示私人 Error Log。</div>'}<div class="doc-shortcuts"><a href="#error-log">查看 Error Log 規則 →</a></div>`;
}

function assessmentPage() {
  const current = `${label(state.language)} ${state.level}`;
  const history = state.assessments.slice().reverse().map((event) => `<div class="assessment-row"><span>${day(event.occurred_at)} · ${label(event.payload.language)} ${escapeHtml(event.payload.level)}</span><strong class="${event.status.passed ? 'pass' : 'pending'}">${event.status.passed ? '達標' : '未達標／待評'}</strong></div>`).join('');
  return `<section class="page-title"><p class="eyebrow">CEFR Gate</p><h1>通過關卡，才前進。</h1><p>目前待通過：${current}。聽力與口說須有實際音訊證據。</p></section><div class="two-column"><article class="panel"><p class="eyebrow">通過標準</p><h2>五項能力都要到位</h2><p>每項 0–4 分，各至少 3 分；合計至少 17 分。聽讀理解各至少 75%，並完成本級情境任務。</p><p>B1 另需 10–15 分鐘對話。缺少音訊或語音證據，關卡保持待評。</p><a class="inline-link" href="#assessment-system">完整評量規則 →</a></article><article class="panel"><p class="eyebrow">關卡紀錄</p><h2>評量歷史</h2>${user ? history || '<p>尚未進行階段測驗。</p>' : '<p>登入後顯示評量紀錄。</p>'}</article></div>`;
}

function setupPage() {
  const connection = !client ? '<div class="empty-state">網站尚未設定 Supabase URL 與 publishable key。請依 README 完成專案及 GitHub Actions 設定。</div>' : user ? `<div class="connected"><strong>已連線</strong><span>${escapeHtml(user.email)}</span></div><button class="button secondary" id="export-data">匯出我的原始紀錄 JSON</button>` : `<form id="login-form" class="login-form"><label>電子郵件<input type="email" id="login-email" required placeholder="you@example.com" /></label><button class="button" type="submit">寄送登入連結</button></form>`;
  return `<section class="page-title"><p class="eyebrow">設定與說明</p><h1>你的學習紀錄，跨裝置接續。</h1><p>網站教材公開；學習歷程只提供登入者讀取。</p></section><article class="panel setup-panel"><h2>帳號與同步</h2>${connection}<p class="small-note">若同步失敗，請保留批改包並稍後重試；成功前不會計入進度。</p></article><article class="document">${linkedMarkdown(readme)}</article>`;
}

function render() {
  state = buildState(events);
  const path = route();
  let body;
  if (path === 'home') body = homePage();
  else if (path === 'roadmap') body = roadmapPage();
  else if (path === 'study') body = studyPage();
  else if (path === 'review') body = reviewPage();
  else if (path === 'errors') body = errorsPage();
  else if (path === 'assessment') body = assessmentPage();
  else if (path === 'setup') body = setupPage();
  else if (docs[path]) body = `<section class="page-title"><p class="eyebrow">專案文件</p><h1>${titles[path]}</h1></section><article class="document">${linkedMarkdown(docs[path])}</article>`;
  else body = '<div class="empty-state">找不到這個頁面。<a href="#home">回到儀表板 →</a></div>';
  shell(body);
  bindActions();
}

async function loadEvents() {
  if (!client || !user) { events = []; render(); return; }
  const { data, error } = await client.from('learning_events').select('id,schema_version,event_type,occurred_at,payload').order('occurred_at', { ascending: true });
  if (error) { notice = `載入紀錄失敗：${error.message}`; render(); return; }
  events = data.map((row) => ({ schema_version: row.schema_version, event_id: row.id, event_type: row.event_type, occurred_at: row.occurred_at, payload: row.payload }));
  render();
}

async function saveEvent(event) {
  validateEvent(event);
  if (!user || !client) throw new Error('請先登入，才能儲存學習紀錄。');
  if (events.some((stored) => stored.event_id === event.event_id)) throw new Error('這個 event_id 已儲存，不能重複計數。');
  const gateError = canRecordEvent(event, buildState(events));
  if (gateError) throw new Error(gateError);
  const { error } = await client.from('learning_events').insert({ id: event.event_id, user_id: user.id, schema_version: 1, event_type: event.event_type, occurred_at: event.occurred_at, payload: event.payload });
  if (error) throw new Error(`同步失敗：${error.message}`);
  notice = event.event_type === 'assessment' ? `評量已儲存：${assessmentStatus(event.payload).passed ? '達標' : '未達標或待評'}。` : '學習紀錄已同步，複習排程已更新。';
  await loadEvents();
}

function bindActions() {
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#login-email').value.trim();
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}` } });
    notice = error ? `寄送失敗：${error.message}` : '登入連結已寄出，請查收電子郵件。';
    render();
  });
  document.querySelector('#copy-request')?.addEventListener('click', async () => {
    const lessonId = document.querySelector('#lesson-id').value.trim();
    const answers = document.querySelector('#raw-answers').value.trim();
    if (!/^(es|it)-(A1|A2|B1)-/.test(lessonId) || !answers) { notice = '請填入有效課次 ID 與原始作答。'; render(); return; }
    const request = { schema_version: 1, event_id: crypto.randomUUID(), event_type: 'lesson', occurred_at: new Date().toISOString(), lesson_id: lessonId, raw_answers: answers, instruction: '請依 system/learning-record.md 逐句批改，回傳單一 LearningEvent v1 JSON；有錄音時另評口說，無音訊不得宣稱完成聽說評量。' };
    try { await navigator.clipboard.writeText(JSON.stringify(request, null, 2)); notice = '作答請求已複製，請貼給 Codex。'; } catch { notice = '無法使用剪貼簿。請改在 HTTPS 或本機網址開啟網站。'; }
    render();
  });
  document.querySelector('#save-feedback')?.addEventListener('click', async () => {
    const field = document.querySelector('#feedback-json');
    const raw = field.value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { await saveEvent(JSON.parse(raw)); } catch (error) { notice = `未儲存：${error.message}`; document.querySelector('.notice')?.remove(); const box = document.createElement('div'); box.className = 'notice'; box.setAttribute('role', 'alert'); box.textContent = notice; document.querySelector('main').prepend(box); }
  });
  document.querySelectorAll('.reveal-card').forEach((button) => button.addEventListener('click', () => { revealedCard = button.dataset.key; render(); }));
  document.querySelectorAll('.review-result').forEach((button) => button.addEventListener('click', async () => {
    const card = state.cards.find((entry) => `${entry.language}:${entry.id}` === button.dataset.key);
    if (!card) return;
    const item = { id: card.id, kind: card.kind, front: card.front, back: card.back, result: button.dataset.result };
    if (card.error_key) item.error_key = card.error_key;
    if (card.error_category) item.error_category = card.error_category;
    const event = { schema_version: 1, event_id: crypto.randomUUID(), event_type: 'review', occurred_at: new Date().toISOString(), payload: { language: card.language, items: [item] } };
    try { await saveEvent(event); revealedCard = null; } catch (error) { notice = `未儲存：${error.message}`; render(); }
  }));
  document.querySelector('#tts-text')?.addEventListener('input', (event) => { ttsText = event.target.value; });
  document.querySelector('#play-tts')?.addEventListener('click', () => {
    ttsText = document.querySelector('#tts-text').value.trim();
    if (!ttsText) { notice = '先貼入本課的音訊文本。'; render(); return; }
    if (!('speechSynthesis' in window)) { notice = '此瀏覽器沒有語音播放功能，請將文本送到外部 TTS。'; render(); return; }
    const targetLanguage = state.language === 'es' ? 'es' : 'it';
    const voice = speechSynthesis.getVoices().find((available) => available.lang.toLowerCase().startsWith(targetLanguage));
    if (!voice) { notice = '目前裝置沒有符合目標語的語音，請使用外部 TTS 播放文本。'; render(); return; }
    ttsHidden = true;
    render();
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(ttsText);
    speech.lang = state.language === 'es' ? 'es-419' : 'it-IT';
    speech.voice = voice;
    speech.rate = 0.9;
    speechSynthesis.speak(speech);
  });
  document.querySelector('#reveal-tts')?.addEventListener('click', () => { ttsHidden = false; render(); });
  document.querySelector('#export-data')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema_version: 1, exported_at: new Date().toISOString(), events }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'language-learning-backup.json'; link.click(); URL.revokeObjectURL(link.href);
  });
}

window.addEventListener('hashchange', () => { notice = ''; render(); });
render();
if (client) {
  client.auth.onAuthStateChange((_event, session) => { user = session?.user || null; queueMicrotask(loadEvents); });
  client.auth.getSession().then(({ data }) => { user = data.session?.user || null; loadEvents(); });
}
