/* ===== Settings (edit freely) ===== */
const CONFIG = {
  focusMin: 30,
  breakMin: 5,
  lat: 30.5965, lng: 32.2715,          // Ismailia
  fajrAngle: 19.5, ishaAngle: 17.5,    // Egyptian General Authority
  storeKey: 'dailyFocus.v1'
};

// Default tasks, used only for the first time a day is opened
const TODAY_DEFAULTS = [
  'مراجعة الدرس الثاني تاريخ',
  'حل واجب التاريخ',
  'قراءة القرآن',
  'محاضرة مي مجدي',
  'حفظ أبو غالية',
  'حل واجب أبو غالية',
  'مذاكرة امتحان البرمجة'
];

const QUOTES = [
  'قليل دائم خير من كثير منقطع.',
  'ابدأ الآن، الحماس هيجي وانت شغال.',
  'كل مهمة بتخلصها بتقرّبك من الهندسة.',
  'التركيز نص ساعة النهاردة بيوفّر ساعات بكرة.',
  'مش لازم تكون مثالي، لازم تكمّل.',
  'إنت بتبني نفسك كل يوم، حتى لو مش شايف.'
];

/* ===== Helpers ===== */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let viewDate = new Date();
let store = JSON.parse(localStorage.getItem(CONFIG.storeKey) || '{}');
const save = () => localStorage.setItem(CONFIG.storeKey, JSON.stringify(store));

function day(d = viewDate) {
  const k = keyOf(d);
  if (!store[k]) {
    const isToday = k === keyOf(new Date());
    store[k] = {
      tasks: isToday ? TODAY_DEFAULTS.map(t => ({ id: crypto.randomUUID(), text: t, done: false, time: '' })) : [],
      prayers: {}
    };
    save();
  }
  return store[k];
}

/* ===== Prayer times (computed offline) ===== */
function prayerTimes(date) {
  const r = Math.PI / 180, { lat, lng } = CONFIG;
  const tz = -date.getTimezoneOffset() / 60;
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 864e5 + 2440587.5;
  const D = jd - 2451545;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = q + 1.915 * Math.sin(g * r) + 0.02 * Math.sin(2 * g * r);
  const e = 23.439 - 3.6e-7 * D;
  const RA = Math.atan2(Math.cos(e * r) * Math.sin(L * r), Math.cos(L * r)) / r / 15;
  const decl = Math.asin(Math.sin(e * r) * Math.sin(L * r)) / r;
  const eqt = q / 15 - ((RA % 24) + 24) % 24;
  const noon = 12 + tz - lng / 15 - ((eqt + 12) % 24 - 12);
  const sd = Math.sin(decl * r), cd = Math.cos(decl * r), sl = Math.sin(lat * r), cl = Math.cos(lat * r);
  const T = a => Math.acos((-Math.sin(a * r) - sl * sd) / (cl * cd)) / r / 15;
  const asrA = Math.atan(1 / (1 + Math.tan(Math.abs(lat - decl) * r))) / r;
  const asr = Math.acos((Math.sin(asrA * r) - sl * sd) / (cl * cd)) / r / 15;
  return [
    ['Fajr', noon - T(CONFIG.fajrAngle)],
    ['Dhuhr', noon + 0.03],
    ['Asr', noon + asr],
    ['Maghrib', noon + T(0.833)],
    ['Isha', noon + T(CONFIG.ishaAngle)]
  ].map(([n, h]) => { const m = Math.round(h * 60); return { name: n, min: m, label: `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}` }; });
}

/* ===== Render ===== */
function render() {
  const d = day(), isToday = keyOf(viewDate) === keyOf(new Date());
  $('dateLabel').textContent = viewDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  $('quote').textContent = QUOTES[viewDate.getDate() % QUOTES.length];

  // tasks
  const list = $('taskList'); list.innerHTML = '';
  const sorted = [...d.tasks].sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  if (!sorted.length) list.innerHTML = '<li class="empty">No tasks yet. Add your first one above.</li>';
  sorted.forEach(t => {
    const li = document.createElement('li'); li.className = 'item' + (t.done ? ' done' : '');
    const c = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'chk', checked: t.done });
    c.onchange = () => { t.done = c.checked; save(); render(); if (t.done) beep(660, .12); };
    const s = Object.assign(document.createElement('span'), { className: 'txt', textContent: t.text, title: 'Double-click to edit' });
    s.dir = 'auto';
    s.ondblclick = () => { const v = prompt('Edit task', t.text); if (v && v.trim()) { t.text = v.trim(); save(); render(); } };
    li.append(c, s);
    if (t.time) li.append(Object.assign(document.createElement('span'), { className: 'time', textContent: t.time }));
    const x = Object.assign(document.createElement('button'), { className: 'del', textContent: '✕', ariaLabel: 'Delete task' });
    x.onclick = () => { d.tasks = d.tasks.filter(z => z.id !== t.id); save(); render(); };
    li.append(x); list.append(li);
  });

  // prayers
  const pl = $('prayerList'); pl.innerHTML = '';
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const times = prayerTimes(viewDate);
  const nxt = isToday ? times.find(p => p.min > nowMin) : null;
  times.forEach(p => {
    const li = document.createElement('li'); li.className = 'item' + (d.prayers[p.name] ? ' done' : '') + (nxt && nxt.name === p.name ? ' next' : '');
    const c = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'chk', checked: !!d.prayers[p.name] });
    c.onchange = () => { d.prayers[p.name] = c.checked; save(); render(); };
    li.append(c, Object.assign(document.createElement('span'), { className: 'name', textContent: p.name }),
      Object.assign(document.createElement('span'), { className: 'time', textContent: p.label }));
    pl.append(li);
  });
  if (nxt) { const m = nxt.min - nowMin; $('nextPrayer').textContent = `${nxt.name} in ${Math.floor(m / 60)}h ${m % 60}m`; }
  else $('nextPrayer').textContent = isToday ? 'Done for today' : '';

  // progress = tasks + prayers
  const total = d.tasks.length + 5, done = d.tasks.filter(t => t.done).length + times.filter(p => d.prayers[p.name]).length;
  const pct = Math.round(done / total * 100);
  $('pct').textContent = pct + '%'; $('barFill').style.width = pct + '%';
  $('taskCount').textContent = `${d.tasks.filter(t => t.done).length}/${d.tasks.length}`;
  if (pct === 100) $('quote').textContent = 'خلصت يومك كله. فخور بيك 🌿';

  renderReviews();
}

/* ===== Spaced reviews (1 / 3 / 7 days) ===== */
const REV_KEY = 'dailyFocus.reviews.v1';
const REV_STEPS = [1, 3, 7];                       // days after studying
let reviews = JSON.parse(localStorage.getItem(REV_KEY) || '[]');
const saveRev = () => localStorage.setItem(REV_KEY, JSON.stringify(reviews));
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const x = parseKey(k); x.setDate(x.getDate() + n); return keyOf(x); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

function addTopic(text) {
  text = (text || '').trim(); if (!text) return;
  const today = keyOf(new Date());
  reviews.push({ id: crypto.randomUUID(), topic: text, created: today, stage: 0, due: addDays(today, REV_STEPS[0]), done: false });
  saveRev(); renderReviews();
}

// remembered: move to next stage (gaps 1 → +2 → +4 days from the real review day). forgot: come back tomorrow.
function answerReview(r, remembered) {
  const today = keyOf(new Date());
  if (remembered) {
    r.stage++;
    if (r.stage >= REV_STEPS.length) r.done = true;
    else r.due = addDays(today, REV_STEPS[r.stage] - REV_STEPS[r.stage - 1]);
  } else {
    r.due = addDays(today, 1);
  }
  saveRev(); renderReviews();
  if (remembered) beep(660, .12);
}

function renderReviews() {
  const list = $('reviewList'); list.innerHTML = '';
  const today = keyOf(new Date());
  const active = reviews.filter(r => !r.done);
  const due = active.filter(r => r.due <= today).sort((a, b) => (a.due < b.due ? -1 : 1));
  const later = active.length - due.length;
  $('reviewCount').textContent = due.length ? `${due.length} due today` : (later ? `${later} upcoming` : '');
  if (!due.length) {
    list.innerHTML = `<li class="empty">${active.length ? 'مفيش مراجعات النهاردة 🌿' : 'سجّل أول درس ذاكرته وهيظهر لك هنا وقت مراجعته.'}</li>`;
    return;
  }
  due.forEach(r => {
    const late = daysBetween(r.due, today);
    const li = document.createElement('li'); li.className = 'item rev';
    const s = Object.assign(document.createElement('span'), { className: 'txt', textContent: r.topic });
    s.dir = 'auto';
    const tag = Object.assign(document.createElement('span'), {
      className: 'time', textContent: `${REV_STEPS[r.stage]}d${late > 0 ? ` · +${late}` : ''}`,
      title: late > 0 ? `متأخرة ${late} يوم` : 'مراجعة النهاردة'
    });
    const ok = Object.assign(document.createElement('button'), { className: 'rbtn ok', textContent: 'فاكره', title: 'فاكره كويس' });
    ok.onclick = () => answerReview(r, true);
    const no = Object.assign(document.createElement('button'), { className: 'rbtn', textContent: 'نسيته', title: 'هترجع بكرة' });
    no.onclick = () => answerReview(r, false);
    const x = Object.assign(document.createElement('button'), { className: 'del', textContent: '✕', ariaLabel: 'Delete topic' });
    x.onclick = () => { reviews = reviews.filter(z => z.id !== r.id); saveRev(); renderReviews(); };
    li.append(s, tag, ok, no, x); list.append(li);
  });
}

$('reviewForm').onsubmit = e => { e.preventDefault(); addTopic($('reviewText').value); $('reviewText').value = ''; };

/* "What did you study?" prompt after each finished focus session */
function askTopic() {
  const dlg = $('topicDlg');
  if (!dlg.showModal || dlg.open) return;
  try { dlg.showModal(); $('topicText').focus(); } catch (_) {}
}
$('topicForm').onsubmit = e => { e.preventDefault(); addTopic($('topicText').value); $('topicText').value = ''; $('topicDlg').close(); };
$('topicSkip').onclick = () => { $('topicText').value = ''; $('topicDlg').close(); };

/* ===== Task form & actions ===== */
$('taskForm').onsubmit = e => {
  e.preventDefault();
  const text = $('taskText').value.trim(); if (!text) return;
  day().tasks.push({ id: crypto.randomUUID(), text, done: false, time: $('taskTime').value });
  $('taskText').value = ''; $('taskTime').value = ''; save(); render();
};
$('clearDone').onclick = () => { const d = day(); d.tasks = d.tasks.filter(t => !t.done); save(); render(); };
$('carry').onclick = () => {
  const prev = new Date(viewDate); prev.setDate(prev.getDate() - 1);
  const p = store[keyOf(prev)]; if (!p) return alert('Nothing to carry over from yesterday.');
  const d = day();
  p.tasks.filter(t => !t.done && !d.tasks.some(x => x.text === t.text))
    .forEach(t => d.tasks.push({ ...t, id: crypto.randomUUID() }));
  save(); render();
};
const shift = n => { viewDate.setDate(viewDate.getDate() + n); render(); };
$('prevDay').onclick = () => shift(-1);
$('nextDay').onclick = () => shift(1);
$('todayBtn').onclick = () => { viewDate = new Date(); render(); };

/* ===== Focus timer (30 / 5) ===== */
let phase = 'focus', endAt = null, remaining = CONFIG.focusMin * 60, tick = null, sessions = 0;
const len = () => (phase === 'focus' ? CONFIG.focusMin : CONFIG.breakMin) * 60;
let ac;
function beep(freq = 880, dur = .25) {
  try {
    ac = ac || new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; g.gain.value = .15; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch (_) {}
}
function drawTimer() {
  const m = Math.floor(remaining / 60), s = Math.floor(remaining % 60);
  $('clock').textContent = `${pad(m)}:${pad(s)}`;
  $('arc').style.strokeDashoffset = 339.3 * (1 - remaining / len());
  $('mode').textContent = phase === 'focus' ? `Focus · ${CONFIG.focusMin} min` : `Break · ${CONFIG.breakMin} min`;
  $('sessions').textContent = `${sessions} session${sessions === 1 ? '' : 's'}`;
  document.body.classList.toggle('break', phase === 'break');
  document.title = tick ? `${pad(m)}:${pad(s)} · ${phase === 'focus' ? 'Focus' : 'Break'}` : 'Daily Focus';
}
function nextPhase(auto) {
  const wasFocus = phase === 'focus';
  if (wasFocus && auto) sessions++;
  phase = wasFocus ? 'break' : 'focus';
  remaining = len();
  if (auto) { endAt = Date.now() + remaining * 1000; beep(phase === 'break' ? 520 : 880, .5); }
  drawTimer();
  if (wasFocus && auto) askTopic();
}
function loop() {
  remaining = Math.max(0, (endAt - Date.now()) / 1000);
  if (remaining <= 0) nextPhase(true); else drawTimer();
}
$('startBtn').onclick = () => {
  if (tick) { clearInterval(tick); tick = null; $('startBtn').textContent = 'Resume'; drawTimer(); return; }
  endAt = Date.now() + remaining * 1000; tick = setInterval(loop, 250);
  $('startBtn').textContent = 'Pause'; drawTimer();
};
$('resetBtn').onclick = () => { clearInterval(tick); tick = null; phase = 'focus'; remaining = len(); $('startBtn').textContent = 'Start'; drawTimer(); };
$('skipBtn').onclick = () => { nextPhase(false); if (tick) endAt = Date.now() + remaining * 1000; };

/* ===== Init ===== */
render(); drawTimer();
setInterval(() => { if (keyOf(viewDate) === keyOf(new Date())) render(); }, 60000);
