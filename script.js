// ===================== CONSTANTS =====================
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];

// Mon–Fri: 6 class slots + breaks
const SLOTS_WEEKDAY = [
  { id:0, start:'08:10', end:'09:00', type:'class' },
  { id:1, start:'09:10', end:'10:00', type:'class' },
  { id:2, start:'10:00', end:'10:10', type:'break', label:'BREAK' },
  { id:3, start:'10:10', end:'11:00', type:'class' },
  { id:4, start:'11:10', end:'12:00', type:'class' },
  { id:5, start:'12:00', end:'12:45', type:'lunch', label:'LUNCH' },
  { id:6, start:'12:45', end:'13:35', type:'class' },
  { id:7, start:'13:45', end:'14:35', type:'class' },
];

// Sat: 4 class slots only
const SLOTS_SAT = [
  { id:0, start:'08:30', end:'09:20', type:'class' },
  { id:1, start:'09:30', end:'10:20', type:'class' },
  { id:2, start:'10:20', end:'10:30', type:'break', label:'BREAK' },
  { id:3, start:'10:30', end:'11:20', type:'class' },
  { id:4, start:'11:30', end:'12:20', type:'class' },
];

const CLASS_COUNT = { Mon:6, Tue:6, Wed:6, Thu:6, Fri:6, Sat:4 };
const SUBJECT_COLORS = ['#ff6b00','#00d4ff','#a8ff3e','#ff3e80','#ffc800','#8c6fff','#ff8c42','#00e5b0'];

function getSlotsForDay(day) { 
  if (day === 'Sun') return []; // Sunday has no classes
  return day === 'Sat' ? SLOTS_SAT : SLOTS_WEEKDAY; 
}

// ===================== STORAGE =====================
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ===================== STATE =====================
const State = {
  winterMode: load('winter', false),
  theme: load('theme', 'ember'),
  textSize: load('textSize', 'medium'),
  currentSubject: null,
  reminderSubjectIdx: null,
  timetableDay: (() => { const d = new Date().getDay(); return d === 0 ? 'Sun' : (d === 6 ? 'Sat' : DAYS[d-1]); })(),
};

// Timetable: { Mon: [{name,color,goodnotes}×6], ..., Sat: [{...}×4], Sun: [] }
let timetable = load('tt_days', null);
if (!timetable) timetable = {};

// Add Sunday to timetable with empty array
if (!timetable.Sun) timetable.Sun = [];

DAYS.forEach(day => {
  const n = CLASS_COUNT[day];
  if (!timetable[day]) timetable[day] = [];
  while (timetable[day].length < n)
    timetable[day].push({ name:'', color: SUBJECT_COLORS[timetable[day].length % SUBJECT_COLORS.length], goodnotes:'' });
  if (timetable[day].length > n) timetable[day] = timetable[day].slice(0, n);
});

let tasks          = load('tasks', {});
let vocab          = load('vocab', {});
let memo           = load('memo', '');
let widgetOrder    = load('widgetOrder', ['widgetClock','widgetDatetime','widgetClass','widgetVocab','widgetMemo','widgetNews','widgetCalendar']);
let widgetEmphasis = load('widgetEmphasis', { widgetClass:true, widgetDatetime:true, widgetClock:true, widgetNews:true });

// ===================== HELPERS =====================
function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function timeToMins(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
function nowString() { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; }
function getSlots(day) {
  const base = getSlotsForDay(day || todayDayKey());
  const off = State.winterMode ? 20 : 0;
  return base.map(s => ({ ...s, start: addMinutes(s.start,off), end: addMinutes(s.end,off) }));
}
function todayDayKey() {
  const d = new Date().getDay();
  if (d === 0) return 'Sun'; // Sunday
  if (d === 6) return 'Sat'; // Saturday
  return DAYS[d-1]; // Mon-Fri
}
function todaySubjects() { return timetable[todayDayKey()] || []; }
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===================== ANALOG CLOCK =====================
function drawAnalogClock() {
  const canvas = document.getElementById('analogClock');
  if (!canvas) return;
  const parent = canvas.parentElement;
  const size = Math.min(parent.offsetWidth, parent.offsetHeight, 240);
  if (size < 20) return;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size/2, cy = size/2, r = size/2 - 3;
  const now = new Date();
  const hrs = now.getHours()%12, mins = now.getMinutes(), secs = now.getSeconds();
  const cs = getComputedStyle(document.body);
  const faceColor  = cs.getPropertyValue('--clock-face').trim();
  const handColor  = cs.getPropertyValue('--clock-hand').trim();
  const tickColor  = cs.getPropertyValue('--clock-tick').trim();
  const accentColor = cs.getPropertyValue('--accent').trim();

  ctx.clearRect(0,0,size,size);

  // Face
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle = faceColor; ctx.fill();
  ctx.strokeStyle = handColor; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.22; ctx.stroke(); ctx.globalAlpha = 1;

  // Tick marks
  for (let i=0; i<60; i++) {
    const a = (i/60)*Math.PI*2 - Math.PI/2;
    const maj = i%5===0;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*(r-1), cy+Math.sin(a)*(r-1));
    ctx.lineTo(cx+Math.cos(a)*(r-1-(maj?r*0.13:r*0.05)), cy+Math.sin(a)*(r-1-(maj?r*0.13:r*0.05)));
    ctx.strokeStyle = maj ? handColor : tickColor;
    ctx.lineWidth = maj ? 1.5 : 0.7;
    ctx.globalAlpha = maj ? 0.65 : 0.35;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Hour hand
  const ha = ((hrs+mins/60)/12)*Math.PI*2 - Math.PI/2;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ha)*r*0.52, cy+Math.sin(ha)*r*0.52);
  ctx.strokeStyle=handColor; ctx.lineWidth=2.8; ctx.lineCap='round'; ctx.stroke();

  // Minute hand
  const ma = ((mins+secs/60)/60)*Math.PI*2 - Math.PI/2;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ma)*r*0.72, cy+Math.sin(ma)*r*0.72);
  ctx.strokeStyle=handColor; ctx.lineWidth=1.8; ctx.lineCap='round'; ctx.stroke();

  // Second hand
  const sa = (secs/60)*Math.PI*2 - Math.PI/2;
  ctx.beginPath();
  ctx.moveTo(cx-Math.cos(sa)*r*0.18, cy-Math.sin(sa)*r*0.18);
  ctx.lineTo(cx+Math.cos(sa)*r*0.80, cy+Math.sin(sa)*r*0.80);
  ctx.strokeStyle=accentColor; ctx.lineWidth=1.0; ctx.lineCap='round'; ctx.stroke();

  // Center dot
  ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fillStyle=accentColor; ctx.fill();
}

// ===================== DIGITAL CLOCK & DATE =====================
function updateClock() {
  const now = new Date();
  document.getElementById('liveClock').textContent =
    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  drawAnalogClock();
  updateClassStatus();
}

function updateDate() {
  const now = new Date();
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  document.getElementById('dateDisplay').textContent =
    `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
}

// ===================== WEATHER =====================
async function fetchWeather() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.45&longitude=139.64&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Asia/Tokyo');
    const data = await r.json();
    const c = data.current;
    document.getElementById('tempDisplay').textContent = `${Math.round(c.temperature_2m)}°`;
    document.getElementById('weatherFeel').textContent = `Feels ${Math.round(c.apparent_temperature)}°`;
    document.getElementById('humidity').textContent = `HUM ${c.relative_humidity_2m}%`;
    document.getElementById('windSpeed').textContent = `WIND ${(c.wind_speed_10m/3.6).toFixed(1)} m/s`;
    const { desc, icon } = weatherInfo(c.weather_code);
    document.getElementById('weatherDesc').textContent = desc;
    document.getElementById('weatherIconSvg').innerHTML = icon;
  } catch { document.getElementById('weatherDesc').textContent = 'OFFLINE'; }
}

function weatherInfo(code) {
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${p}</svg>`;
  if (code===0)  return { desc:'CLEAR',   icon:svg('<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>') };
  if (code<=3)   return { desc:'CLOUDY',  icon:svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>') };
  if (code<=48)  return { desc:'FOGGY',   icon:svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="6" y1="23" x2="18" y2="23"/>') };
  if (code<=67)  return { desc:'RAIN',    icon:svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="23" x2="8" y2="21"/><line x1="12" y1="23" x2="12" y2="21"/><line x1="16" y1="23" x2="16" y2="21"/>') };
  if (code<=77)  return { desc:'SNOW',    icon:svg('<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>') };
  if (code<=82)  return { desc:'SHOWERS', icon:svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="23" x2="8" y2="21"/><line x1="12" y1="23" x2="12" y2="21"/>') };
  return { desc:'STORM', icon:svg('<polyline points="13,11 9,17 15,17 11,23"/><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>') };
}

// ===================== CLASS STATUS =====================
function updateClassStatus() {
  const nowMins = timeToMins(nowString());
  const dayKey = todayDayKey();
  
  // Handle Sunday - no classes
  if (dayKey === 'Sun') {
    const badge = document.getElementById('classStatusBadge');
    const slotTime = document.getElementById('classSlotTime');
    const nameBig = document.getElementById('classNameBig');
    const nextRow = document.getElementById('classNextRow');
    const fill = document.getElementById('classProgressFill');
    const lbl = document.getElementById('classProgressLabel');
    
    badge.textContent = 'NO CLASSES';
    badge.className = 'class-status-badge';
    nameBig.textContent = 'No classes today';
    nameBig.className = 'class-name-big';
    nameBig.style.color = 'var(--text)';
    slotTime.textContent = '';
    fill.style.width = '0%';
    lbl.textContent = '';
    nextRow.style.display = 'none';
    State.currentSubject = null;
    return;
  }
  
  const slots = getSlots(dayKey);
  const classSlots = slots.filter(s => s.type === 'class');
  const subjects = timetable[dayKey] || [];
  const getSubj = i => subjects[i] || { name:'', color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] };

  let curClassIdx = -1, isBreak = false, breakLabel = 'BREAK';
  for (const s of slots) {
    if (nowMins >= timeToMins(s.start) && nowMins < timeToMins(s.end)) {
      if (s.type === 'class') curClassIdx = classSlots.findIndex(c => c.id === s.id);
      else { isBreak = true; breakLabel = s.label || 'BREAK'; }
      break;
    }
  }
  const inGap = curClassIdx===-1 && !isBreak &&
    nowMins >= timeToMins(slots[0].start) && nowMins < timeToMins(slots[slots.length-1].end);

  const badge    = document.getElementById('classStatusBadge');
  const slotTime = document.getElementById('classSlotTime');
  const nameBig  = document.getElementById('classNameBig');
  const nextRow  = document.getElementById('classNextRow');
  const nextName = document.getElementById('classNextName');
  const nextTime = document.getElementById('classNextTime');
  const fill     = document.getElementById('classProgressFill');
  const lbl      = document.getElementById('classProgressLabel');

  if (curClassIdx >= 0) {
    const slot = classSlots[curClassIdx];
    const subj = getSubj(curClassIdx);
    State.currentSubject = { idx: curClassIdx, ...subj };
    badge.textContent = 'IN CLASS'; badge.className = 'class-status-badge';
    slotTime.textContent = `${slot.start} — ${slot.end}`;
    nameBig.textContent = subj.name || `CLASS ${curClassIdx+1}`;
    nameBig.className = 'class-name-big';
    nameBig.style.color = subj.color || 'var(--accent)';
    const pct = ((nowMins - timeToMins(slot.start)) / (timeToMins(slot.end) - timeToMins(slot.start))) * 100;
    fill.style.width = `${Math.min(100,pct).toFixed(1)}%`;
    lbl.textContent = `${timeToMins(slot.end)-nowMins}min left`;
    const next = classSlots[curClassIdx+1];
    if (next) { nextRow.style.display='flex'; nextName.textContent=getSubj(curClassIdx+1).name||`CLASS ${curClassIdx+2}`; nextTime.textContent=next.start; }
    else nextRow.style.display='none';

  } else if (isBreak || inGap) {
    badge.textContent = breakLabel; badge.className = 'class-status-badge break';
    nameBig.className = 'class-name-big'; nameBig.style.color = 'var(--text)';
    nameBig.textContent = breakLabel; slotTime.textContent=''; fill.style.width='0%'; lbl.textContent='';
    let nxt = null, ni = -1;
    for (let i=0; i<classSlots.length; i++) {
      if (timeToMins(classSlots[i].start) > nowMins) { nxt = classSlots[i]; ni = i; break; }
    }
    if (nxt) {
      State.currentSubject = { idx:ni, ...getSubj(ni) };
      nextRow.style.display='flex'; nextName.textContent=getSubj(ni).name||`CLASS ${ni+1}`; nextTime.textContent=nxt.start;
    } else nextRow.style.display='none';

  } else {
    const before = nowMins < timeToMins(slots[0].start);
    badge.textContent = before ? 'BEFORE SCHOOL' : 'DONE'; badge.className = 'class-status-badge';
    nameBig.className = 'class-name-big'; nameBig.style.color = 'var(--text)';
    nameBig.textContent = before ? 'SCHOOL STARTS' : 'SEE YOU'; slotTime.textContent=''; fill.style.width='0%'; lbl.textContent='';
    if (before) {
      nextRow.style.display='flex';
      nextName.textContent=getSubj(0).name||'CLASS 1'; nextTime.textContent=classSlots[0]?.start||'--:--';
      State.currentSubject = { idx:0, ...getSubj(0) };
    } else { nextRow.style.display='none'; State.currentSubject=null; }
  }
}

// ===================== TIMETABLE PAGE =====================
function renderTimetableTabs() {
  const day = State.timetableDay;
  document.getElementById('ttDayTabs').innerHTML = DAYS.map(d =>
    `<button class="tt-day-tab${d===day?' active':''}" data-day="${d}" onclick="renderTimetableDay('${d}')">${d.toUpperCase()}</button>`
  ).join('');
}

function renderTimetableDay(day) {
  State.timetableDay = day;
  document.querySelectorAll('.tt-day-tab').forEach(t => t.classList.toggle('active', t.dataset.day===day));
  const slots = getSlots(day);
  const subjects = timetable[day];
  let ci = 0;
  const html = [];
  for (const slot of slots) {
    if (slot.type !== 'class') {
      html.push(`<div class="tt-slot tt-break">
        <div class="tt-time">${slot.start} — ${slot.end}</div>
        <div class="tt-break-label">${slot.label}</div>
      </div>`);
    } else {
      const i = ci;
      const d = subjects[i] || { name:'', color: SUBJECT_COLORS[i%SUBJECT_COLORS.length], goodnotes:'' };
      html.push(`<div class="tt-slot">
        <div class="tt-time">${slot.start} — ${slot.end}</div>
        <input class="tt-input" placeholder="Subject name..." value="${escHtml(d.name)}"
          oninput="saveTT('${day}',${i},'name',this.value)" style="border-bottom-color:${d.color}">
        <input type="color" class="tt-color-picker" value="${d.color}"
          oninput="saveTT('${day}',${i},'color',this.value)">
      </div>`);
      ci++;
    }
  }
  document.getElementById('timetableGrid').innerHTML = html.join('');
  renderWeekPreview();
}

function renderWeekPreview() {
  const cols = DAYS.map(day =>
    `<div class="tt-week-col">
      <div class="tt-week-day-label">${day.toUpperCase()}<span class="tt-week-count">${CLASS_COUNT[day]}p</span></div>
      ${timetable[day].map((s,i)=>
        `<div class="tt-week-item" style="border-left-color:${s.color}">${escHtml(s.name)||`P${i+1}`}</div>`
      ).join('')}
    </div>`
  ).join('');
  document.getElementById('ttWeekPreview').innerHTML =
    `<div class="tt-week-title">// WEEKLY OVERVIEW</div><div class="tt-week-grid">${cols}</div>`;
}

function saveTT(day, idx, field, val) {
  timetable[day][idx][field] = val;
  save('tt_days', timetable);
  updateClassStatus();
  renderWeekPreview();
  renderSettingsGN();
}

// ===================== GOODNOTES =====================
function openGoodnotes() {
  const today = todayDayKey();
  const subjects = timetable[today];
  const nowMins = timeToMins(nowString());
  const classSlots = getSlots(today).filter(s => s.type==='class');
  let curIdx = classSlots.findIndex(s => nowMins>=timeToMins(s.start) && nowMins<timeToMins(s.end));
  if (curIdx===-1) curIdx = classSlots.findIndex(s => timeToMins(s.start)>nowMins);

  document.getElementById('goodnotesContent').innerHTML = subjects.map((s,i) =>
    `<div class="gn-link-item" style="${i===curIdx?'opacity:1':'opacity:0.55'}">
      <div>
        <div class="gn-subject-name" style="color:${s.color}">${escHtml(s.name)||`Class ${i+1}`}</div>
        <input class="gn-input" placeholder="goodnotes://..." value="${escHtml(s.goodnotes||'')}"
          oninput="saveTT('${today}',${i},'goodnotes',this.value)">
      </div>
      <button class="gn-open-btn" style="background:${s.color||'var(--accent)'};color:var(--bg)"
        onclick="openGNLink('${today}',${i})">OPEN</button>
    </div>`
  ).join('');

  if (curIdx>=0 && subjects[curIdx]?.goodnotes) window.open(subjects[curIdx].goodnotes,'_blank');
  openModal('goodnotes');
}

function openGNLink(day, idx) {
  const link = timetable[day]?.[idx]?.goodnotes;
  if (link) window.open(link,'_blank');
  else alert('No GoodNotes link set. Enter a link in the field above.');
}

// ===================== REMINDERS =====================
function openReminder() {
  if (!State.currentSubject) return;
  const idx = State.currentSubject.idx;
  State.reminderSubjectIdx = idx;
  const subj = timetable[todayDayKey()][idx];
  document.getElementById('reminderSubjectTitle').textContent = `${escHtml(subj?.name||'CLASS '+(idx+1))} // TASKS`;
  renderReminderList();
  openModal('reminder');
}

function renderReminderList() {
  const idx = State.reminderSubjectIdx;
  const list = tasks[idx] || [];
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('reminderList').innerHTML = list.map((t,i) =>
    `<div class="reminder-item">
      <div class="reminder-item-name">${escHtml(t.name)}</div>
      <div class="reminder-item-date ${t.deadline&&t.deadline<today?'task-card-overdue':''}">${t.deadline||'---'}</div>
      <button class="reminder-item-del" onclick="deleteTask(${i})">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`
  ).join('') || '<div style="font-size:11px;color:var(--text3);padding:6px 0">No tasks</div>';
  renderCalendarPreview();
}

function addTask() {
  const name = document.getElementById('taskName').value.trim();
  const deadline = document.getElementById('taskDeadline').value;
  const notify = document.getElementById('taskNotify').checked;
  if (!name) return;
  const idx = State.reminderSubjectIdx;
  if (!tasks[idx]) tasks[idx] = [];
  tasks[idx].push({ id:Date.now(), name, deadline, notify });
  save('tasks', tasks);
  document.getElementById('taskName').value = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskNotify').checked = false;
  renderReminderList();
  if (notify && deadline && 'Notification' in window) {
    Notification.requestPermission().then(p => {
      if (p==='granted') {
        const diff = new Date(deadline+'T09:00:00') - new Date();
        if (diff>0) setTimeout(()=>new Notification(`Task: ${name}`,{body:'Due today'}), diff);
      }
    });
  }
}

function deleteTask(ti) {
  tasks[State.reminderSubjectIdx].splice(ti,1);
  save('tasks', tasks);
  renderReminderList();
}

// ===================== CALENDAR =====================
let calMonth = new Date().getMonth(), calYear = new Date().getFullYear();

function getAllTasks() {
  const day = todayDayKey();
  const arr = [];
  Object.entries(tasks).forEach(([idx, list]) => {
    const subj = timetable[day][parseInt(idx)];
    list.forEach(t => arr.push({ ...t, subjectName: subj?.name||`C${parseInt(idx)+1}`, color: subj?.color||SUBJECT_COLORS[parseInt(idx)%SUBJECT_COLORS.length] }));
  });
  return arr.sort((a,b) => (a.deadline||'z').localeCompare(b.deadline||'z'));
}

function renderCalendarPreview() {
  const all = getAllTasks();
  document.getElementById('calendarPreview').innerHTML = all.slice(0,4).map(t =>
    `<div class="cal-task-item">
      <div class="cal-dot" style="background:${t.color}"></div>
      <div class="cal-task-name">${escHtml(t.name)}</div>
      <div class="cal-task-date">${t.deadline||'---'}</div>
    </div>`
  ).join('') || '<div class="cal-empty">No tasks</div>';
}

function renderFullCalendar() {
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const today = new Date().toISOString().slice(0,10);
  const taskDates = new Set();
  Object.values(tasks).forEach(l => l.forEach(t => { if(t.deadline) taskDates.add(t.deadline); }));
  const first = new Date(calYear, calMonth, 1).getDay();
  const dim = new Date(calYear, calMonth+1, 0).getDate();
  const dayL = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  let dh = dayL.map(d=>`<div class="cal-day-label">${d}</div>`).join('');
  for (let i=0;i<first;i++) dh+=`<div class="cal-day empty"></div>`;
  for (let d=1;d<=dim;d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    dh += `<div class="cal-day${ds===today?' today':''}${taskDates.has(ds)?' has-tasks':''}">${d}</div>`;
  }
  document.getElementById('fullCalendarWidget').innerHTML = `
    <div class="cal-month-header">
      <button class="cal-nav-btn" onclick="changeCalMonth(-1)">&#8249;</button>
      <div class="cal-month-title">${months[calMonth]} ${calYear}</div>
      <button class="cal-nav-btn" onclick="changeCalMonth(1)">&#8250;</button>
    </div>
    <div class="cal-days-grid">${dh}</div>`;

  const all = getAllTasks();
  document.getElementById('taskListFull').innerHTML = all.map(t => {
    const over = t.deadline && t.deadline < today;
    return `<div class="task-card" style="border-left-color:${t.color}">
      <div class="task-card-subject" style="color:${t.color}">${escHtml(t.subjectName)}</div>
      <div class="task-card-name">${escHtml(t.name)}</div>
      <div class="task-card-date ${over?'task-card-overdue':''}">${t.deadline||'---'}</div>
    </div>`;
  }).join('') || '<div style="font-size:11px;color:var(--text3)">No tasks</div>';
}

function changeCalMonth(d) {
  calMonth+=d;
  if (calMonth>11) { calMonth=0; calYear++; }
  if (calMonth<0)  { calMonth=11; calYear--; }
  renderFullCalendar();
}

// ===================== VOCAB =====================
let vocabDate = new Date().toISOString().slice(0,10);

function addVocab() {
  const word = document.getElementById('vWord').value.trim();
  if (!word) return;
  if (!vocab[vocabDate]) vocab[vocabDate] = [];
  vocab[vocabDate].push({
    word, jp: document.getElementById('vJp').value.trim(),
    pos: document.getElementById('vPos').value,
    meaning: document.getElementById('vMeaning').value.trim(),
    example: document.getElementById('vExample').value.trim(),
  });
  save('vocab', vocab);
  ['vWord','vJp','vMeaning','vExample'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('vPos').value='';
  renderVocabList(); renderVocabDateNav(); updateVocabCount();
}

function renderVocabDateNav() {
  document.getElementById('vocabDateNav').innerHTML = Object.keys(vocab).sort().reverse().map(d =>
    `<button class="date-nav-btn${d===vocabDate?' active':''}" onclick="selectVocabDate('${d}')">${d}</button>`
  ).join('');
}
function selectVocabDate(d) { vocabDate=d; renderVocabDateNav(); renderVocabList(); }

function renderVocabList() {
  const list = vocab[vocabDate] || [];
  document.getElementById('vocabList').innerHTML = list.map((v,i) => `
    <div class="vocab-card">
      <div class="vocab-card-pos">${escHtml(v.pos)}</div>
      <div class="vocab-card-main">
        <div class="vocab-card-word">${escHtml(v.word)}</div>
        <div class="vocab-card-jp">${escHtml(v.jp)}</div>
        ${v.meaning?`<div class="vocab-card-meaning">${escHtml(v.meaning)}</div>`:''}
        ${v.example?`<div class="vocab-card-example">"${escHtml(v.example)}"</div>`:''}
      </div>
      <button class="vocab-card-del" onclick="deleteVocab(${i})">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/>
        </svg>
      </button>
    </div>`).join('') || '<div class="vocab-empty">No words for this date</div>';
}

function deleteVocab(i) {
  vocab[vocabDate].splice(i,1);
  if (!vocab[vocabDate].length) delete vocab[vocabDate];
  save('vocab', vocab); renderVocabList(); renderVocabDateNav(); updateVocabCount();
}

function updateVocabCount() {
  const today = new Date().toISOString().slice(0,10);
  const list = vocab[today] || [];
  document.getElementById('vocabCount').textContent = `${list.length} word${list.length!==1?'s':''}`;
  document.getElementById('vocabPreview').innerHTML = list.slice(0,3).map(v =>
    `<div class="vocab-preview-item">
      <span class="vpi-pos">${escHtml(v.pos)}</span>
      <span class="vpi-word">${escHtml(v.word)}</span>
      <span class="vpi-jp">${escHtml(v.jp)}</span>
    </div>`
  ).join('') || '<div class="vocab-empty">Add today\'s words...</div>';
}

// ===================== MEMO =====================
function initMemo() {
  const ta = document.getElementById('memoTextarea');
  ta.value = memo;
  ta.addEventListener('input', () => {
    memo = ta.value; save('memo', memo);
    document.getElementById('memoMeta').textContent =
      'SAVED ' + new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  });
}

// ===================== NEWS (EXTERNAL) =====================
// Chain: Wikipedia Featured Article → The Guardian open → Hacker News → curated fallback

async function renderNews() {
  const today = new Date().toISOString().slice(0,10);
  const cached = load('news_cache', null);
  if (cached && cached.date===today && cached.article?.headline) {
    showNewsArticle(cached.article); return;
  }

  // 1. Wikipedia Today's Featured Article
  try {
    const mm = String(new Date().getMonth()+1).padStart(2,'0');
    const dd = String(new Date().getDate()).padStart(2,'0');
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/featured/${new Date().getFullYear()}/${mm}/${dd}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (r.ok) {
      const data = await r.json();
      const fa = data.tfa;
      if (fa?.title && fa?.extract && fa.extract.length > 100) {
        // Extract is often long; take up to 700 chars
        const body = fa.extract.length > 700
          ? fa.extract.slice(0, 697) + '...'
          : fa.extract;
        const article = {
          headline: fa.title.replace(/_/g,' '),
          body,
          source: "WIKIPEDIA — TODAY'S FEATURED ARTICLE",
          jp: '',
          url: fa.content_urls?.desktop?.page || '',
        };
        save('news_cache', { date:today, article });
        showNewsArticle(article); return;
      }
    }
  } catch {}

  // 2. The Guardian (open API key = "test", allows ~12 req/day free)
  try {
    const r = await fetch(
      'https://content.guardianapis.com/search?q=world&show-fields=trailText,bodyText&page-size=1&order-by=newest&api-key=test',
      { signal: AbortSignal.timeout(6000) }
    );
    if (r.ok) {
      const data = await r.json();
      const item = data.response?.results?.[0];
      if (item) {
        const trail = (item.fields?.trailText||'').replace(/<[^>]+>/g,'');
        const fullBody = (item.fields?.bodyText||'').replace(/<[^>]+>/g,'');
        const body = fullBody.length > 50 ? fullBody.slice(0,700) : trail;
        const article = { headline: item.webTitle, body, source:'THE GUARDIAN', jp:'', url: item.webUrl||'' };
        save('news_cache', { date:today, article });
        showNewsArticle(article); return;
      }
    }
  } catch {}

  // 3. Hacker News top story (Algolia)
  try {
    const r = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const data = await r.json();
      const item = data.hits?.[0];
      if (item?.title) {
        const article = {
          headline: item.title,
          body: `This story is trending on Hacker News with ${item.points||0} points and ${item.num_comments||0} comments, posted by ${item.author||'unknown'}. Hacker News is a social news website run by Y Combinator that focuses on computer science and entrepreneurship. Submissions cover topics from technology and science to economics and philosophy. The discussion threads frequently feature detailed technical perspectives from engineers, researchers, and founders around the world. Visit the link to read the full article and join the community discussion.`,
          source: 'HACKER NEWS',
          jp: '',
          url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
        };
        save('news_cache', { date:today, article });
        showNewsArticle(article); return;
      }
    }
  } catch {}

  // 4. Curated fallback pool (long-form)
  const POOL = [
    {
      headline: "Japan's AI Investment Surge Reshapes the Technology Landscape",
      body: "Major Japanese corporations are redirecting unprecedented capital toward artificial intelligence infrastructure, with analysts noting a structural shift in the nation's technology investment priorities. Firms across finance, manufacturing, and retail are forming joint ventures focused on large-scale model deployment and edge computing solutions. The government's latest digital transformation initiative has allocated substantial subsidies for domestic AI chip research, positioning Japan as a serious contender in the global race for semiconductor independence. Industry leaders argue the move will create high-value employment and reverse decades of engineering brain drain, while critics warn that the rapid pace of automation could deepen inequality unless reskilling programmes keep pace with technological displacement.",
      source: 'REUTERS', jp: '日本の大手企業がAIインフラへ前例のない投資を実施。政府も補助金でAIチップ研究を支援し、半導体自立化を推進。雇用創出が期待される一方、格差拡大への懸念も。',
    },
    {
      headline: "Breakthrough in Quantum Error Correction Opens Path to Practical Computing",
      body: "Research teams at leading universities and private laboratories have jointly demonstrated quantum error correction operating at scales previously considered a decade away from realisation. The technique employs a novel topological qubit architecture that dramatically reduces decoherence — the primary physical barrier to reliable quantum computation at scale. Practical implications span pharmaceutical drug discovery, materials science, financial risk modelling, and the long-term security of public-key cryptographic systems that underpin global digital infrastructure. Several major technology companies have announced plans to incorporate the findings into their next-generation hardware roadmaps, while regulators are beginning to assess the implications for existing encryption standards.",
      source: 'SCIENCE', jp: '量子エラー訂正の新手法により実用的な量子計算への道が開かれました。創薬・材料科学から暗号技術まで広範な分野への影響が期待されます。',
    },
    {
      headline: "Pacific Nations Present Landmark Climate Accountability Framework",
      body: "Island nations across the Pacific have presented a coalition proposal at the latest round of international climate negotiations that would make emissions reduction targets legally binding and introduce automatic financial penalties for non-compliance. The proposal challenges the voluntary pledge system established under the Paris Agreement, which critics argue has produced insufficient action. Negotiators from the European Union expressed cautious support, while major emitters sought procedural delays. Scientific advisors released a parallel assessment showing that at current trajectories, sea-level rise will render several low-lying atolls permanently uninhabitable within thirty years, and that extreme weather events are already displacing coastal communities faster than adaptation measures can respond.",
      source: 'AP NEWS', jp: '太平洋島嶼国が法的拘束力ある排出削減目標と自動ペナルティ制度を提案。現状の軌道では30年以内に複数の環礁が居住不能になると科学者が警告。',
    },
    {
      headline: "Tokyo's Urban Renewal Projects Ignite Debate Over Heritage and Modernity",
      body: "A wave of large-scale redevelopment projects transforming central Tokyo neighbourhoods has sparked an intense public debate about the city's architectural identity and the appropriate pace of change. Historic shopping arcades, pre-war wooden townhouses, and postwar concrete landmarks face demolition to accommodate mixed-use towers and transit-oriented developments. Urban planners argue the projects are essential to address a severe housing shortage, improve structural earthquake resilience, and attract international commercial activity. Preservation advocates counter that Tokyo risks erasing the layered urban fabric that distinguishes it from generic global cities, and that demolishing existing structures generates significant embodied carbon emissions that undermine stated sustainability commitments.",
      source: 'NIKKEI', jp: '東京中心部の大規模再開発が建築アイデンティティ論争を激化。住宅不足解消・耐震化が急務な一方、文化遺産の喪失とCO₂排出増への懸念も高まっています。',
    },
    {
      headline: "Lunar Resource Survey Returns Highest-Resolution Maps of Polar Ice Deposits",
      body: "An international consortium of space agencies has released the first detailed dataset from their coordinated orbital survey of the Moon, providing the highest-resolution maps yet of water-ice distribution in permanently shadowed polar craters. The data reveals previously unknown concentrations of volatile compounds at shallower depths than models predicted, dramatically improving prospects for in-situ resource utilisation to support crewed missions. Scientists described the findings as transformative for the economics of long-duration lunar exploration, suggesting that extracting local water for drinking, oxygen production, and hydrogen fuel could reduce resupply costs by orders of magnitude. Multiple commercial operators are reviewing the maps to identify extraction sites, raising early questions about the international governance of celestial resources.",
      source: 'NASA/ESA', jp: '月周回調査で極域の水氷を高解像度マッピング。予測より浅い位置に大量の揮発性物質を確認。月面有人拠点の資源自給に向けた実現可能性が大幅に向上しました。',
    },
    {
      headline: "Global Semiconductor Realignment Accelerates as New Fabs Break Ground",
      body: "The global semiconductor industry is undergoing its most significant geographic restructuring in decades, driven by strategic export controls, industrial policy competition, and growing concern about supply chain concentration in a handful of East Asian locations. New fabrication facilities are breaking ground across South and Southeast Asia, Europe, and North America, with governments offering increasingly generous incentive packages to attract advanced chip manufacturing. Industry analysts note that while the diversification improves resilience against geopolitical disruption, the enormous capital requirements of cutting-edge process nodes mean that only a small number of facilities worldwide will ever reach the technological frontier. The transition is also creating new bottlenecks in specialist lithography equipment and the ultra-pure chemical supply chains that support advanced patterning.",
      source: 'FT', jp: '半導体製造の地理的再編が加速。各国が製造拠点誘致に補助金競争を展開する一方、極端紫外線露光装置や超高純度化学品の供給に新たなボトルネックが生じています。',
    },
    {
      headline: "Deep-Sea Expedition Uncovers Ecosystems Unknown to Science",
      body: "An extended research expedition deploying next-generation autonomous submersibles has returned from the deep trenches east of the Japanese archipelago with evidence of biological communities entirely unknown to science. Researchers documented seventeen candidate species new to taxonomy, including chemosynthetic microorganisms and macrofauna that derive energy from geological hydrogen seeps rather than photosynthesis. The discovery fundamentally challenges existing models of energy flux and biodiversity in abyssal environments. Marine biologists are calling for expanded international protections for deep-sea habitats in the face of growing commercial interest in polymetallic nodule mining, which could irreversibly destroy ecosystems that have evolved over millions of years before they are even catalogued.",
      source: 'NATURE', jp: '日本東部海溝の深海調査で科学未知の生態系を発見。17種の新種候補を記録。地質水素から化学合成で生きる生物も確認され、生命進化の理解を塗り替える可能性があります。',
    },
  ];
  const seed = parseInt(today.replace(/-/g,'')) % POOL.length;
  const article = POOL[seed];
  save('news_cache', { date:today, article });
  showNewsArticle(article);
}

function showNewsArticle(a) {
  document.getElementById('newsContent').innerHTML = `
    <div class="news-inner">
      <div class="news-text-block">
        <div class="news-source-tag">// ${escHtml(a.source)} — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()}</div>
        <div class="news-headline">${escHtml(a.headline)}</div>
        <div class="news-en-body">${escHtml(a.body)}</div>
        ${a.jp?`<div class="news-jp-body">${escHtml(a.jp)}</div>`:''}
        ${a.url?`<a class="news-link" href="${escHtml(a.url)}" target="_blank" rel="noopener">READ FULL ARTICLE ↗</a>`:''}
      </div>
    </div>`;
}

// ===================== WINTER MODE =====================
function toggleWinter() {
  State.winterMode = !State.winterMode; save('winter', State.winterMode);
  document.getElementById('winterToggle').classList.toggle('active', State.winterMode);
  document.getElementById('winterBanner').classList.toggle('visible', State.winterMode);
  document.body.classList.toggle('winter-active', State.winterMode);
  updateClassStatus();
}

// ===================== THEME =====================
function setTheme(theme) {
  State.theme = theme; save('theme', theme);
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-chip').forEach(el => el.classList.toggle('active', el.dataset.theme===theme));
  setTimeout(drawAnalogClock, 50);
}

function setTextSize(size) {
  State.textSize = size; save('textSize', size);
  document.body.setAttribute('data-text-size', size);
  document.getElementById('textSizeSelect').value = size;
}

// ===================== NAVIGATION =====================
function openPage(name) {
  const el = document.getElementById(`page${name[0].toUpperCase()+name.slice(1)}`);
  if (!el) return;
  el.style.display='flex'; requestAnimationFrame(()=>el.classList.add('active'));
  if (name==='timetable') { renderTimetableTabs(); renderTimetableDay(State.timetableDay); }
  if (name==='vocab') { renderVocabDateNav(); renderVocabList(); }
  if (name==='calendar') renderFullCalendar();
}
function closePage(name) {
  const el = document.getElementById(`page${name[0].toUpperCase()+name.slice(1)}`);
  if (!el) return;
  el.classList.remove('active'); setTimeout(()=>el.style.display='none',350);
}
function openModal(name) {
  const el = document.getElementById(`modal${name[0].toUpperCase()+name.slice(1)}`);
  if (el) { el.style.display='flex'; requestAnimationFrame(()=>el.classList.add('active')); }
}
function closeModal(name) {
  const el = document.getElementById(`modal${name[0].toUpperCase()+name.slice(1)}`);
  if (el) { el.classList.remove('active'); setTimeout(()=>el.style.display='none',250); }
}

// ===================== WIDGET EMPHASIS =====================
function applyWidgetEmphasis() {
  document.querySelectorAll('#emphasisList input[type=checkbox]').forEach(cb => {
    const w = document.getElementById(cb.dataset.widget);
    if (w) w.dataset.emphasized = cb.checked?'true':'false';
    widgetEmphasis[cb.dataset.widget] = cb.checked;
  });
  save('widgetEmphasis', widgetEmphasis);
}
function initEmphasisCheckboxes() {
  document.querySelectorAll('#emphasisList input[type=checkbox]').forEach(cb => {
    cb.checked = !!widgetEmphasis[cb.dataset.widget];
    const w = document.getElementById(cb.dataset.widget);
    if (w) w.dataset.emphasized = cb.checked?'true':'false';
    cb.addEventListener('change', applyWidgetEmphasis);
  });
}

// ===================== WIDGET ORDER =====================
const WIDGET_LABELS = { widgetClock:'ANALOG CLOCK', widgetDatetime:'DATE/WEATHER', widgetClass:'CLASS STATUS', widgetVocab:'VOCAB', widgetMemo:'QUICK NOTE', widgetNews:'NEWS', widgetCalendar:'TASKS' };

function renderWidgetOrderList() {
  const list = document.getElementById('widgetOrderList');
  list.innerHTML = widgetOrder.map((id,i) =>
    `<div class="order-item" draggable="true" data-id="${id}" data-idx="${i}">
      <span class="drag-handle">⠿</span><span>${WIDGET_LABELS[id]||id}</span>
    </div>`).join('');
  list.querySelectorAll('.order-item').forEach(item => {
    item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain',item.dataset.idx); item.classList.add('dragging'); });
    item.addEventListener('dragend', ()=>item.classList.remove('dragging'));
    item.addEventListener('dragover', e=>{ e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', ()=>item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over');
      const from=parseInt(e.dataTransfer.getData('text/plain')), to=parseInt(item.dataset.idx);
      if (from!==to) { const a=[...widgetOrder]; const [m]=a.splice(from,1); a.splice(to,0,m); widgetOrder=a; save('widgetOrder',widgetOrder); renderWidgetOrderList(); }
    });
  });
}

// ===================== CSV IMPORT/EXPORT =====================
function importCSV() {
  const text = document.getElementById('csvImport').value.trim();
  if (!text) return;
  text.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line => {
    const [day, slot, name, color, goodnotes] = line.split(',').map(s=>s?.trim()||'');
    const dayKey = DAYS.find(d=>d.toLowerCase()===day?.toLowerCase());
    const si = parseInt(slot)-1;
    if (!dayKey || isNaN(si) || si<0 || si>=CLASS_COUNT[dayKey]) return;
    if (name) timetable[dayKey][si].name = name;
    if (color) timetable[dayKey][si].color = color;
    if (goodnotes) timetable[dayKey][si].goodnotes = goodnotes;
  });
  save('tt_days', timetable);
  document.getElementById('csvImport').value = '';
  alert('Import successful!');
  updateClassStatus();
}

function exportCSV() {
  const lines = [];
  DAYS.forEach(day => timetable[day].forEach((s,i) => {
    if (s.name) lines.push(`${day},${i+1},${s.name},${s.color},${s.goodnotes||''}`);
  }));
  const blob = new Blob([lines.join('\n')],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),{href:url,download:'timetable.csv'}).click();
  URL.revokeObjectURL(url);
}

// ===================== SETTINGS GN LINKS =====================
function renderSettingsGN() {
  const cont = document.getElementById('settingsGNLinks');
  if (!cont) return;
  cont.innerHTML = DAYS.map(day => `
    <div style="margin-bottom:14px">
      <div class="settings-label" style="margin-bottom:6px">${day.toUpperCase()} — ${CLASS_COUNT[day]} PERIODS</div>
      ${timetable[day].map((s,i) => `
        <div class="gn-link-item">
          <div>
            <div class="gn-subject-name" style="color:${s.color}">${escHtml(s.name)||`Class ${i+1}`}</div>
            <input class="gn-input" placeholder="goodnotes://..." value="${escHtml(s.goodnotes||'')}"
              oninput="saveTT('${day}',${i},'goodnotes',this.value)">
          </div>
          <button class="gn-open-btn" style="background:${s.color||'var(--accent)'};color:var(--bg)"
            onclick="openGNLink('${day}',${i})">OPEN</button>
        </div>`).join('')}
    </div>`).join('');
}

// ===================== INIT =====================
function init() {
  document.body.setAttribute('data-theme', State.theme);
  document.body.setAttribute('data-text-size', State.textSize);
  document.querySelectorAll('.theme-chip').forEach(el => el.classList.toggle('active', el.dataset.theme===State.theme));
  document.getElementById('textSizeSelect').value = State.textSize;
  document.getElementById('winterToggle').classList.toggle('active', State.winterMode);
  document.getElementById('winterBanner').classList.toggle('visible', State.winterMode);
  document.body.classList.toggle('winter-active', State.winterMode);

  updateDate(); updateClock(); fetchWeather(); renderNews();
  renderCalendarPreview(); updateVocabCount(); initMemo();
  initEmphasisCheckboxes(); renderWidgetOrderList(); renderSettingsGN();

  document.getElementById('winterToggle').addEventListener('click', toggleWinter);
  document.getElementById('settingsBtn').addEventListener('click', ()=>{ renderSettingsGN(); renderWidgetOrderList(); openModal('settings'); });
  document.getElementById('timetableBtn').addEventListener('click', ()=>openPage('timetable'));
  document.getElementById('reminderBtn').addEventListener('click', openReminder);
  document.getElementById('goodnotesBtn').addEventListener('click', openGoodnotes);

  document.querySelectorAll('.modal-overlay').forEach(el =>
    el.addEventListener('click', e=>{ if(e.target===el){ el.classList.remove('active'); setTimeout(()=>el.style.display='none',250); } })
  );

  setInterval(updateClock, 1000);
  setInterval(fetchWeather, 10*60*1000);
  setInterval(updateDate, 60*1000);
  window.addEventListener('resize', drawAnalogClock);
  if ('Notification' in window && Notification.permission==='default') Notification.requestPermission();
}

document.addEventListener('DOMContentLoaded', init);