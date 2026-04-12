// ===================== CONSTANTS =====================
const DAYS = [‘Mon’,‘Tue’,‘Wed’,‘Thu’,‘Fri’,‘Sat’];

const SLOTS_WEEKDAY = [
{ id:0, start:‘08:10’, end:‘09:00’, type:‘class’ },
{ id:1, start:‘09:10’, end:‘10:00’, type:‘class’ },
{ id:2, start:‘10:00’, end:‘10:10’, type:‘break’,  label:‘BREAK’ },
{ id:3, start:‘10:10’, end:‘11:00’, type:‘class’ },
{ id:4, start:‘11:10’, end:‘12:00’, type:‘class’ },
{ id:5, start:‘12:00’, end:‘12:45’, type:‘lunch’,  label:‘LUNCH’ },
{ id:6, start:‘12:45’, end:‘13:35’, type:‘class’ },
{ id:7, start:‘13:45’, end:‘14:35’, type:‘class’ },
];
const SLOTS_SAT = [
{ id:0, start:‘08:30’, end:‘09:20’, type:‘class’ },
{ id:1, start:‘09:30’, end:‘10:20’, type:‘class’ },
{ id:2, start:‘10:20’, end:‘10:30’, type:‘break’,  label:‘BREAK’ },
{ id:3, start:‘10:30’, end:‘11:20’, type:‘class’ },
{ id:4, start:‘11:30’, end:‘12:20’, type:‘class’ },
];
const CLASS_COUNT   = { Mon:6, Tue:6, Wed:6, Thu:6, Fri:6, Sat:4 };
const SUBJECT_COLORS = [’#ff6b00’,’#00d4ff’,’#a8ff3e’,’#ff3e80’,’#ffc800’,’#8c6fff’,’#ff8c42’,’#00e5b0’];

function getSlotsForDay(day) { return day === ‘Sat’ ? SLOTS_SAT : SLOTS_WEEKDAY; }

// ===================== STORAGE =====================
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ===================== STATE =====================
const State = {
winterMode: load(‘winter’, false),
theme:      load(‘theme’,  ‘ember’),
timetableDay: (() => { const d = new Date().getDay(); return d === 0 ? ‘Mon’ : DAYS[Math.min(d-1,5)]; })(),
taskSubjectFilter: null, // null = no filter (show all)
};

// Timetable: { Mon:[{name,color,goodnotes}×6], …, Sat:[…]×4 }
let timetable = load(‘tt_days’, null);
if (!timetable) timetable = {};
DAYS.forEach(day => {
const n = CLASS_COUNT[day];
if (!timetable[day]) timetable[day] = [];
while (timetable[day].length < n)
timetable[day].push({ name:’’, color: SUBJECT_COLORS[timetable[day].length % SUBJECT_COLORS.length], goodnotes:’’ });
if (timetable[day].length > n) timetable[day] = timetable[day].slice(0, n);
});

// Tasks: flat array of { id, name, subjectKey, deadline, done }
// subjectKey = “Mon-2” (day + “-” + slotIndex), or “” for no subject
let tasks = load(‘tasks_v2’, []);
// Migrate old tasks format if needed
if (!Array.isArray(tasks)) {
const migrated = [];
Object.entries(tasks).forEach(([idx, list]) => {
(list || []).forEach(t => {
migrated.push({ id: t.id || Date.now(), name: t.name || ‘’, subjectKey: `Mon-${idx}`, deadline: t.deadline || ‘’, done: false });
});
});
tasks = migrated;
save(‘tasks_v2’, tasks);
}

let memo = load(‘memo’, ‘’);

// ===================== HELPERS =====================
function addMinutes(time, mins) {
const [h, m] = time.split(’:’).map(Number);
const t = h * 60 + m + mins;
return `${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function timeToMins(t) { const [h,m] = t.split(’:’).map(Number); return h*60+m; }
function nowString()   { const n = new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; }
function todayDayKey() { const d = new Date().getDay(); return d === 0 ? ‘Mon’ : DAYS[Math.min(d-1,5)]; }
function getSlots(day) {
const off = State.winterMode ? 20 : 0;
return getSlotsForDay(day || todayDayKey()).map(s => ({ …s, start: addMinutes(s.start,off), end: addMinutes(s.end,off) }));
}
function escHtml(s) {
return (s||’’).replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}
// All subjects across all days as { key:“Mon-0”, name, color, day, idx }
function allSubjects() {
const list = [];
DAYS.forEach(day => {
timetable[day].forEach((s, idx) => {
list.push({ key: `${day}-${idx}`, name: s.name || `${day} P${idx+1}`, color: s.color, day, idx });
});
});
return list;
}

// ===================== ANALOG CLOCK =====================
function drawAnalogClock() {
const canvas = document.getElementById(‘analogClock’);
if (!canvas) return;
const parent = canvas.parentElement;
const size = Math.min(parent.offsetWidth, parent.offsetHeight, 240);
if (size < 20) return;
canvas.width = size; canvas.height = size;
const ctx = canvas.getContext(‘2d’);
const cx = size/2, cy = size/2, r = size/2 - 3;
const now = new Date();
const hrs = now.getHours()%12, mins = now.getMinutes(), secs = now.getSeconds();
const cs = getComputedStyle(document.body);
const faceColor  = cs.getPropertyValue(’–clock-face’).trim();
const handColor  = cs.getPropertyValue(’–clock-hand’).trim();
const tickColor  = cs.getPropertyValue(’–clock-tick’).trim();
const accentColor = cs.getPropertyValue(’–accent’).trim();

ctx.clearRect(0,0,size,size);
ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
ctx.fillStyle = faceColor; ctx.fill();
ctx.strokeStyle = handColor; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.22; ctx.stroke(); ctx.globalAlpha = 1;

for (let i=0; i<60; i++) {
const a = (i/60)*Math.PI*2 - Math.PI/2, maj = i%5===0;
ctx.beginPath();
ctx.moveTo(cx+Math.cos(a)*(r-1), cy+Math.sin(a)*(r-1));
ctx.lineTo(cx+Math.cos(a)*(r-1-(maj?r*0.13:r*0.05)), cy+Math.sin(a)*(r-1-(maj?r*0.13:r*0.05)));
ctx.strokeStyle = maj ? handColor : tickColor; ctx.lineWidth = maj ? 1.5 : 0.7;
ctx.globalAlpha = maj ? 0.65 : 0.35; ctx.stroke();
}
ctx.globalAlpha = 1;

const drawHand = (angle, len, w, color, tail) => {
ctx.beginPath();
if (tail) ctx.moveTo(cx-Math.cos(angle)*r*0.18, cy-Math.sin(angle)*r*0.18);
else ctx.moveTo(cx, cy);
ctx.lineTo(cx+Math.cos(angle)*len, cy+Math.sin(angle)*len);
ctx.strokeStyle=color; ctx.lineWidth=w; ctx.lineCap=‘round’; ctx.stroke();
};
drawHand(((hrs+mins/60)/12)*Math.PI*2-Math.PI/2, r*0.52, 2.8, handColor);
drawHand(((mins+secs/60)/60)*Math.PI*2-Math.PI/2, r*0.72, 1.8, handColor);
drawHand((secs/60)*Math.PI*2-Math.PI/2, r*0.80, 1.0, accentColor, true);
ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fillStyle=accentColor; ctx.fill();
}

// ===================== CLOCK & DATE =====================
function updateClock() {
const now = new Date();
document.getElementById(‘liveClock’).textContent =
`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
drawAnalogClock();
updateClassStatus();
}
function updateDate() {
const now = new Date();
const days   = [‘SUN’,‘MON’,‘TUE’,‘WED’,‘THU’,‘FRI’,‘SAT’];
const months = [‘JAN’,‘FEB’,‘MAR’,‘APR’,‘MAY’,‘JUN’,‘JUL’,‘AUG’,‘SEP’,‘OCT’,‘NOV’,‘DEC’];
document.getElementById(‘dateDisplay’).textContent =
`${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
}

// ===================== WEATHER =====================
async function fetchWeather() {
try {
const r = await fetch(‘https://api.open-meteo.com/v1/forecast?latitude=35.45&longitude=139.64&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Asia/Tokyo’);
const data = await r.json(); const c = data.current;
document.getElementById(‘tempDisplay’).textContent  = `${Math.round(c.temperature_2m)}°`;
document.getElementById(‘weatherFeel’).textContent  = `Feels ${Math.round(c.apparent_temperature)}°`;
document.getElementById(‘humidity’).textContent     = `HUM ${c.relative_humidity_2m}%`;
document.getElementById(‘windSpeed’).textContent    = `WIND ${(c.wind_speed_10m/3.6).toFixed(1)} m/s`;
const { desc, icon } = weatherInfo(c.weather_code);
document.getElementById(‘weatherDesc’).textContent  = desc;
document.getElementById(‘weatherIconSvg’).innerHTML = icon;
} catch { document.getElementById(‘weatherDesc’).textContent = ‘OFFLINE’; }
}
function weatherInfo(code) {
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${p}</svg>`;
if (code===0)  return { desc:‘CLEAR’,   icon:svg(’<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>’) };
if (code<=3)   return { desc:‘CLOUDY’,  icon:svg(’<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>’) };
if (code<=48)  return { desc:‘FOGGY’,   icon:svg(’<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="6" y1="23" x2="18" y2="23"/>’) };
if (code<=67)  return { desc:‘RAIN’,    icon:svg(’<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="23" x2="8" y2="21"/><line x1="12" y1="23" x2="12" y2="21"/><line x1="16" y1="23" x2="16" y2="21"/>’) };
if (code<=77)  return { desc:‘SNOW’,    icon:svg(’<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>’) };
if (code<=82)  return { desc:‘SHOWERS’, icon:svg(’<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="8" y1="23" x2="8" y2="21"/><line x1="12" y1="23" x2="12" y2="21"/>’) };
return { desc:‘STORM’, icon:svg(’<polyline points="13,11 9,17 15,17 11,23"/><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>’) };
}

// ===================== CLASS STATUS =====================
function updateClassStatus() {
const nowMins  = timeToMins(nowString());
const dayKey   = todayDayKey();
const slots    = getSlots(dayKey);
const clsSlots = slots.filter(s => s.type === ‘class’);
const subjects = timetable[dayKey] || [];
const getSubj  = i => subjects[i] || { name:’’, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] };

let curClassIdx = -1, isBreak = false, breakLabel = ‘BREAK’;
for (const s of slots) {
if (nowMins >= timeToMins(s.start) && nowMins < timeToMins(s.end)) {
if (s.type === ‘class’) curClassIdx = clsSlots.findIndex(c => c.id === s.id);
else { isBreak = true; breakLabel = s.label || ‘BREAK’; }
break;
}
}
const inGap = curClassIdx===-1 && !isBreak &&
nowMins >= timeToMins(slots[0].start) && nowMins < timeToMins(slots[slots.length-1].end);

const badge    = document.getElementById(‘classStatusBadge’);
const slotTime = document.getElementById(‘classSlotTime’);
const nameBig  = document.getElementById(‘classNameBig’);
const nextRow  = document.getElementById(‘classNextRow’);
const fill     = document.getElementById(‘classProgressFill’);
const lbl      = document.getElementById(‘classProgressLabel’);

if (curClassIdx >= 0) {
const slot = clsSlots[curClassIdx], subj = getSubj(curClassIdx);
badge.textContent = ‘IN CLASS’; badge.className = ‘class-status-badge in-class’;
slotTime.textContent = `${slot.start} — ${slot.end}`;
nameBig.textContent = subj.name || `CLASS ${curClassIdx+1}`;
nameBig.className = ‘class-name-big in-class’; nameBig.style.color = subj.color || ‘var(–accent)’;
const pct = ((nowMins - timeToMins(slot.start)) / (timeToMins(slot.end) - timeToMins(slot.start))) * 100;
fill.style.width = `${Math.min(100,pct).toFixed(1)}%`; lbl.textContent = `${timeToMins(slot.end)-nowMins}min left`;
const next = clsSlots[curClassIdx+1];
if (next) { nextRow.style.display=‘flex’; document.getElementById(‘classNextName’).textContent=getSubj(curClassIdx+1).name||`CLASS ${curClassIdx+2}`; document.getElementById(‘classNextTime’).textContent=next.start; }
else nextRow.style.display=‘none’;

} else if (isBreak || inGap) {
badge.textContent = breakLabel; badge.className = ‘class-status-badge break’;
nameBig.className=‘class-name-big’; nameBig.style.color=‘var(–text)’;
nameBig.textContent=breakLabel; slotTime.textContent=’’; fill.style.width=‘0%’; lbl.textContent=’’;
let nxt=null, ni=-1;
for (let i=0;i<clsSlots.length;i++) { if (timeToMins(clsSlots[i].start)>nowMins){nxt=clsSlots[i];ni=i;break;} }
if (nxt) { nextRow.style.display=‘flex’; document.getElementById(‘classNextName’).textContent=getSubj(ni).name||`CLASS ${ni+1}`; document.getElementById(‘classNextTime’).textContent=nxt.start; }
else nextRow.style.display=‘none’;

} else {
const before = nowMins < timeToMins(slots[0].start);
badge.textContent = before ? ‘BEFORE SCHOOL’ : ‘DONE’; badge.className = ‘class-status-badge’;
nameBig.className=‘class-name-big’; nameBig.style.color=‘var(–text)’;
nameBig.textContent = before ? ‘SCHOOL STARTS’ : ‘SEE YOU’; slotTime.textContent=’’; fill.style.width=‘0%’; lbl.textContent=’’;
if (before) { nextRow.style.display=‘flex’; document.getElementById(‘classNextName’).textContent=getSubj(0).name||‘CLASS 1’; document.getElementById(‘classNextTime’).textContent=clsSlots[0]?.start||’–:–’; }
else nextRow.style.display=‘none’;
}
}

// ===================== TIMETABLE PAGE =====================
function renderTimetableTabs() {
document.getElementById(‘ttDayTabs’).innerHTML = DAYS.map(d =>
`<button class="tt-day-tab${d===State.timetableDay?' active':''}" data-day="${d}" onclick="renderTimetableDay('${d}')">${d.toUpperCase()}</button>`
).join(’’);
}
function renderTimetableDay(day) {
State.timetableDay = day;
document.querySelectorAll(’.tt-day-tab’).forEach(t => t.classList.toggle(‘active’, t.dataset.day===day));
const slots = getSlots(day); let ci = 0;
document.getElementById(‘timetableGrid’).innerHTML = slots.map(slot => {
if (slot.type !== ‘class’) return `<div class="tt-slot tt-break"><div class="tt-time">${slot.start} — ${slot.end}</div><div class="tt-break-label">${slot.label}</div></div>`;
const i = ci++, d = timetable[day][i] || { name:’’, color:SUBJECT_COLORS[i%SUBJECT_COLORS.length], goodnotes:’’ };
return `<div class="tt-slot"> <div class="tt-time">${slot.start} — ${slot.end}</div> <input class="tt-input" placeholder="Subject name..." value="${escHtml(d.name)}" oninput="saveTT('${day}',${i},'name',this.value)" style="border-bottom-color:${d.color}"> <input type="color" class="tt-color-picker" value="${d.color}" oninput="saveTT('${day}',${i},'color',this.value)"> </div>`;
}).join(’’);
renderWeekPreview();
}
function renderWeekPreview() {
document.getElementById(‘ttWeekPreview’).innerHTML =
`<div class="tt-week-title">// WEEKLY OVERVIEW</div> <div class="tt-week-grid">${DAYS.map(day => `<div class="tt-week-col">
<div class="tt-week-day-label">${day.toUpperCase()}<span class="tt-week-count">${CLASS_COUNT[day]}p</span></div>
${timetable[day].map((s,i)=>`<div class="tt-week-item" style="border-left-color:${s.color}">${escHtml(s.name)||`P${i+1}`}</div>`).join(’’)}
</div>`).join('')} </div>`;
}
function saveTT(day, idx, field, val) {
timetable[day][idx][field] = val;
save(‘tt_days’, timetable);
updateClassStatus();
renderWeekPreview();
renderSettingsGN();
renderTaskSubjectRow(); // refresh subject chips in task widget
}

// ===================== GOODNOTES =====================
function openGoodnotes() {
const today   = todayDayKey();
const subjects = timetable[today];
const nowMins  = timeToMins(nowString());
const clsSlots = getSlots(today).filter(s => s.type===‘class’);
let curIdx = clsSlots.findIndex(s => nowMins>=timeToMins(s.start) && nowMins<timeToMins(s.end));
if (curIdx===-1) curIdx = clsSlots.findIndex(s => timeToMins(s.start)>nowMins);

document.getElementById(‘goodnotesContent’).innerHTML = subjects.map((s,i) =>
`<div class="gn-link-item" style="${i===curIdx?'opacity:1':'opacity:0.55'}"> <div> <div class="gn-subject-name" style="color:${s.color}">${escHtml(s.name)||`Class ${i+1}`}</div> <input class="gn-input" placeholder="goodnotes://..." value="${escHtml(s.goodnotes||'')}" oninput="saveTT('${today}',${i},'goodnotes',this.value)"> </div> <button class="gn-open-btn" style="background:${s.color||'var(--accent)'};color:var(--bg)" onclick="openGNLink('${today}',${i})">OPEN</button> </div>`
).join(’’);

if (curIdx>=0 && subjects[curIdx]?.goodnotes) window.open(subjects[curIdx].goodnotes,’_blank’);
openModal(‘goodnotes’);
}
function openGNLink(day, idx) {
const link = timetable[day]?.[idx]?.goodnotes;
if (link) window.open(link,’_blank’);
else alert(‘No GoodNotes link set. Enter a link above.’);
}

// ===================== TASKS =====================
function renderTaskSubjectRow() {
const subjects = allSubjects().filter(s => s.name && !s.name.startsWith(s.day+’ P’));
const row = document.getElementById(‘taskSubjectRow’);
// “ALL” chip + one chip per named subject
const chips = [{ key: null, name: ‘ALL’, color: ‘var(–text3)’ }, …subjects];
row.innerHTML = chips.map(s =>
`<button class="task-subject-chip${State.taskSubjectFilter===s.key?' active':''}" style="${s.key && s.key!==null ? `–chip-color:${s.color}` : ''}" onclick="setTaskFilter(${s.key===null?'null':`’${s.key}’`})">${escHtml(s.name)}</button>`
).join(’’);
}

function setTaskFilter(key) {
State.taskSubjectFilter = key;
renderTaskSubjectRow();
renderTaskWidgetList();
}

function renderTaskWidgetList() {
const today = new Date().toISOString().slice(0,10);
let list = tasks.filter(t => !t.done);

// Apply subject filter
if (State.taskSubjectFilter !== null) {
list = list.filter(t => t.subjectKey === State.taskSubjectFilter);
}

// Sort: overdue first, then by deadline, then no-deadline at end
list.sort((a,b) => {
const ad = a.deadline || ‘zzzz’, bd = b.deadline || ‘zzzz’;
return ad.localeCompare(bd);
});

const el = document.getElementById(‘taskWidgetList’);
if (!list.length) {
el.innerHTML = ‘<div class="task-widget-empty">No tasks</div>’;
return;
}

// Find subject info for color
const subjMap = {};
allSubjects().forEach(s => { subjMap[s.key] = s; });

el.innerHTML = list.map(t => {
const subj = t.subjectKey ? subjMap[t.subjectKey] : null;
const color = subj?.color || ‘var(–text3)’;
const over  = t.deadline && t.deadline < today;
const dateLabel = t.deadline
? (over ? `⚠ ${t.deadline}` : t.deadline)
: ‘’;
return `<div class="task-widget-item" data-id="${t.id}"> <button class="task-check-btn" onclick="toggleTaskDone('${t.id}')" style="border-color:${color}"></button> <div class="task-widget-body"> <div class="task-widget-name">${escHtml(t.name)}</div> ${t.subjectKey && subj ? `<div class="task-widget-subj" style="color:${color}">${escHtml(subj.name)}</div>`: ''} </div> ${dateLabel ?`<div class="task-widget-date ${over?'overdue':''}">${dateLabel}</div>` : ''} <button class="task-del-btn" onclick="deleteTask('${t.id}')"> <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> </button> </div>`;
}).join(’’);
}

function addTask() {
const nameEl = document.getElementById(‘taskNameInline’);
const name   = nameEl.value.trim();
if (!name) { nameEl.focus(); return; }
const deadline = document.getElementById(‘taskDeadlineInline’).value;
const task = {
id:         String(Date.now()),
name,
subjectKey: State.taskSubjectFilter || ‘’,
deadline,
done:       false,
};
tasks.push(task);
save(‘tasks_v2’, tasks);
nameEl.value = ‘’;
document.getElementById(‘taskDeadlineInline’).value = ‘’;
renderTaskWidgetList();
renderMiniCalendar();
}

function toggleTaskDone(id) {
const t = tasks.find(t => t.id === id);
if (!t) return;
t.done = true; // mark done → hide from list
save(‘tasks_v2’, tasks);
renderTaskWidgetList();
renderMiniCalendar();
}

function deleteTask(id) {
tasks = tasks.filter(t => t.id !== id);
save(‘tasks_v2’, tasks);
renderTaskWidgetList();
renderMiniCalendar();
}

// ===================== MINI CALENDAR (widget-calendar) =====================
function renderMiniCalendar() {
const now   = new Date();
const year  = now.getFullYear(), month = now.getMonth();
const today = now.toISOString().slice(0,10);
const taskDates = new Set(tasks.filter(t=>!t.done&&t.deadline).map(t=>t.deadline));
const months = [‘JAN’,‘FEB’,‘MAR’,‘APR’,‘MAY’,‘JUN’,‘JUL’,‘AUG’,‘SEP’,‘OCT’,‘NOV’,‘DEC’];
const first  = new Date(year, month, 1).getDay();
const dim    = new Date(year, month+1, 0).getDate();
const dayL   = [‘S’,‘M’,‘T’,‘W’,‘T’,‘F’,‘S’];

let dh = dayL.map(d=>`<div class="mc-label">${d}</div>`).join(’’);
for (let i=0;i<first;i++) dh+=`<div class="mc-day empty"></div>`;
for (let d=1;d<=dim;d++) {
const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
dh += `<div class="mc-day${ds===today?' today':''}${taskDates.has(ds)?' has-tasks':''}">${d}</div>`;
}

document.getElementById(‘miniCalendar’).innerHTML =
`<div class="mc-header"><span class="mc-month">${months[month]} ${year}</span></div> <div class="mc-grid">${dh}</div>`;
}

// ===================== MEMO =====================
function initMemo() {
const ta = document.getElementById(‘memoTextarea’);
ta.value = memo;
ta.addEventListener(‘input’, () => {
memo = ta.value; save(‘memo’, memo);
document.getElementById(‘memoMeta’).textContent =
’SAVED ’ + new Date().toLocaleTimeString(‘en-US’,{hour:‘2-digit’,minute:‘2-digit’,hour12:false});
});
}

// ===================== NEWS =====================
async function renderNews() {
const today  = new Date().toISOString().slice(0,10);
const cached = load(‘news_cache’, null);
if (cached && cached.date===today && cached.article?.headline) { showNewsArticle(cached.article); return; }

// 1. Wikipedia Featured Article
try {
const mm = String(new Date().getMonth()+1).padStart(2,‘0’);
const dd = String(new Date().getDate()).padStart(2,‘0’);
const r = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${new Date().getFullYear()}/${mm}/${dd}`, { signal: AbortSignal.timeout(6000) });
if (r.ok) {
const data = await r.json(); const fa = data.tfa;
if (fa?.title && fa?.extract && fa.extract.length > 100) {
const article = { headline: fa.title.replace(/_/g,’ ‘), body: fa.extract.length>700?fa.extract.slice(0,697)+’…’:fa.extract, source:“WIKIPEDIA — TODAY’S FEATURED ARTICLE”, jp:’’, url: fa.content_urls?.desktop?.page||’’ };
save(‘news_cache’,{date:today,article}); showNewsArticle(article); return;
}
}
} catch {}

// 2. The Guardian
try {
const r = await fetch(‘https://content.guardianapis.com/search?q=world&show-fields=trailText,bodyText&page-size=1&order-by=newest&api-key=test’, { signal: AbortSignal.timeout(6000) });
if (r.ok) {
const data = await r.json(); const item = data.response?.results?.[0];
if (item) {
const trail = (item.fields?.trailText||’’).replace(/<[^>]+>/g,’’);
const body  = (item.fields?.bodyText||’’).replace(/<[^>]+>/g,’’).slice(0,700) || trail;
const article = { headline: item.webTitle, body, source:‘THE GUARDIAN’, jp:’’, url: item.webUrl||’’ };
save(‘news_cache’,{date:today,article}); showNewsArticle(article); return;
}
}
} catch {}

// 3. Hacker News
try {
const r = await fetch(‘https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1’, { signal: AbortSignal.timeout(5000) });
if (r.ok) {
const data = await r.json(); const item = data.hits?.[0];
if (item?.title) {
const article = { headline: item.title, body:`Trending on Hacker News with ${item.points||0} points and ${item.num_comments||0} comments, posted by ${item.author||'unknown'}. Hacker News is a social news platform run by Y Combinator covering technology, science, and entrepreneurship. The discussion threads attract engineers, researchers, and founders worldwide. Visit the link to read the full article and join the community discussion.`, source:‘HACKER NEWS’, jp:’’, url: item.url||`https://news.ycombinator.com/item?id=${item.objectID}` };
save(‘news_cache’,{date:today,article}); showNewsArticle(article); return;
}
}
} catch {}

// Fallback pool
const POOL = [
{ headline:“Japan’s AI Investment Surge Reshapes the Technology Landscape”, body:“Major Japanese corporations are redirecting unprecedented capital toward artificial intelligence infrastructure, with analysts noting a structural shift in the nation’s technology investment priorities. Firms across finance, manufacturing, and retail are forming joint ventures focused on large-scale model deployment and edge computing solutions. The government’s latest digital transformation initiative has allocated substantial subsidies for domestic AI chip research, positioning Japan as a serious contender in the global race for semiconductor independence.”, source:‘REUTERS’, jp:‘日本の大手企業がAIインフラへ前例のない投資を実施。政府補助金でAIチップ研究を支援し、半導体自立化を推進しています。’, url:’’ },
{ headline:“Breakthrough in Quantum Error Correction Opens Path to Practical Computing”, body:“Research teams have demonstrated quantum error correction at scales previously considered a decade away. The technique employs a topological qubit architecture that dramatically reduces decoherence — the primary barrier to reliable quantum computation. Practical implications span pharmaceutical drug discovery, materials science, financial risk modelling, and the long-term security of public-key cryptographic systems.”, source:‘SCIENCE’, jp:‘量子エラー訂正の新手法により実用的な量子計算への道が開かれました。創薬・材料科学から暗号技術まで広範な分野への影響が期待されます。’, url:’’ },
{ headline:“Pacific Nations Present Landmark Climate Accountability Framework”, body:“Island nations across the Pacific have presented a coalition proposal at international climate negotiations that would make emissions targets legally binding and introduce automatic financial penalties for non-compliance. Scientific advisors released an assessment showing sea-level rise will render several low-lying atolls uninhabitable within thirty years at current trajectories.”, source:‘AP NEWS’, jp:‘太平洋島嶼国が法的拘束力ある排出削減目標と自動ペナルティ制度を提案。現状では30年以内に複数の環礁が居住不能になると科学者が警告。’, url:’’ },
{ headline:“Tokyo’s Urban Renewal Ignites Debate Over Heritage and Modernity”, body:“A wave of large-scale redevelopment projects transforming central Tokyo has sparked intense debate about the city’s architectural identity. Historic shopping arcades, pre-war wooden townhouses, and postwar concrete landmarks face demolition for mixed-use towers. Urban planners argue the projects address housing shortages and seismic resilience, while preservationists warn Tokyo risks erasing its distinctive layered urban fabric.”, source:‘NIKKEI’, jp:‘東京中心部の大規模再開発が建築アイデンティティ論争を激化。住宅不足解消・耐震化が急務な一方、文化遺産の喪失への懸念も高まっています。’, url:’’ },
{ headline:“Lunar Resource Survey Returns Highest-Resolution Maps of Polar Ice”, body:“An international consortium of space agencies has released the first detailed dataset from their coordinated orbital survey of the Moon, providing the highest-resolution maps of water-ice distribution in permanently shadowed polar craters. Data reveals volatile compounds at shallower depths than predicted, dramatically improving prospects for in-situ resource utilisation to support crewed missions.”, source:‘NASA/ESA’, jp:‘月周回調査で極域の水氷を高解像度マッピング。予測より浅い位置に大量の揮発性物質を確認し、月面有人拠点の資源自給可能性が向上しました。’, url:’’ },
{ headline:“Semiconductor Supply Chain Realignment Accelerates”, body:“The global semiconductor industry is undergoing its most significant geographic restructuring in decades. New fabrication facilities are breaking ground across South Asia, Southeast Asia, Europe, and North America, driven by export controls and strategic industrial policy. Analysts note that while diversification improves resilience, the capital requirements of advanced nodes mean only a handful of facilities will reach the technological frontier.”, source:‘FT’, jp:‘半導体製造の地理的再編が加速。各国が製造拠点誘致に競争を展開する一方、先端ノードの資本集約性から技術フロンティアに到達できる拠点は限られる見込みです。’, url:’’ },
{ headline:“Deep-Sea Expedition Uncovers Ecosystems Unknown to Science”, body:“An extended research expedition has returned from the deep trenches east of Japan with evidence of biological communities entirely unknown to science. Researchers documented seventeen candidate new species, including chemosynthetic organisms that derive energy from geological hydrogen seeps. Marine biologists are calling for expanded international protections for deep-sea habitats threatened by polymetallic nodule mining.”, source:‘NATURE’, jp:‘日本東部海溝の深海調査で科学未知の生態系を発見。地質水素から化学合成で生きる生物も確認され、生命進化の理解を塗り替える可能性があります。’, url:’’ },
];
const seed = parseInt(today.replace(/-/g,’’)) % POOL.length;
const article = POOL[seed];
save(‘news_cache’,{date:today,article}); showNewsArticle(article);
}

function showNewsArticle(a) {
document.getElementById(‘newsContent’).innerHTML = ` <div class="news-text-block"> <div class="news-source-tag">// ${escHtml(a.source)} — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()}</div> <div class="news-headline">${escHtml(a.headline)}</div> <div class="news-en-body">${escHtml(a.body)}</div> ${a.jp?`<div class="news-jp-body">${escHtml(a.jp)}</div>`:''} ${a.url?`<a class="news-link" href="${escHtml(a.url)}" target="_blank" rel="noopener">READ FULL ARTICLE ↗</a>`:''} </div>`;
}

// ===================== WINTER / THEME / NAV =====================
function toggleWinter() {
State.winterMode = !State.winterMode; save(‘winter’, State.winterMode);
document.getElementById(‘winterToggle’).classList.toggle(‘active’, State.winterMode);
document.getElementById(‘winterBanner’).classList.toggle(‘visible’, State.winterMode);
document.body.classList.toggle(‘winter-active’, State.winterMode);
updateClassStatus();
}
function setTheme(theme) {
State.theme = theme; save(‘theme’, theme);
document.body.setAttribute(‘data-theme’, theme);
document.querySelectorAll(’.theme-chip’).forEach(el => el.classList.toggle(‘active’, el.dataset.theme===theme));
setTimeout(drawAnalogClock, 50);
}
function openPage(name) {
const el = document.getElementById(`page${name[0].toUpperCase()+name.slice(1)}`);
if (!el) return;
el.style.display=‘flex’; requestAnimationFrame(()=>el.classList.add(‘active’));
if (name===‘timetable’) { renderTimetableTabs(); renderTimetableDay(State.timetableDay); }
}
function closePage(name) {
const el = document.getElementById(`page${name[0].toUpperCase()+name.slice(1)}`);
if (!el) return;
el.classList.remove(‘active’); setTimeout(()=>el.style.display=‘none’,350);
}
function openModal(name) {
const el = document.getElementById(`modal${name[0].toUpperCase()+name.slice(1)}`);
if (el) { el.style.display=‘flex’; requestAnimationFrame(()=>el.classList.add(‘active’)); }
}
function closeModal(name) {
const el = document.getElementById(`modal${name[0].toUpperCase()+name.slice(1)}`);
if (el) { el.classList.remove(‘active’); setTimeout(()=>el.style.display=‘none’,250); }
}

// ===================== SETTINGS GN =====================
function renderSettingsGN() {
const cont = document.getElementById(‘settingsGNLinks’);
if (!cont) return;
cont.innerHTML = DAYS.map(day => `<div style="margin-bottom:14px"> <div class="settings-label" style="margin-bottom:6px">${day.toUpperCase()} — ${CLASS_COUNT[day]} PERIODS</div> ${timetable[day].map((s,i) =>`
<div class="gn-link-item">
<div>
<div class="gn-subject-name" style="color:${s.color}">${escHtml(s.name)||`Class ${i+1}`}</div>
<input class="gn-input" placeholder="goodnotes://..." value="${escHtml(s.goodnotes||'')}"
oninput="saveTT('${day}',${i},'goodnotes',this.value)">
</div>
<button class="gn-open-btn" style="background:${s.color||'var(--accent)'};color:var(--bg)"
onclick="openGNLink('${day}',${i})">OPEN</button>
</div>`).join('')} </div>`).join(’’);
}

// ===================== CSV IMPORT/EXPORT =====================
function importCSV() {
const text = document.getElementById(‘csvImport’).value.trim();
if (!text) return;
text.split(’\n’).map(l=>l.trim()).filter(Boolean).forEach(line => {
const [day, slot, name, color, goodnotes] = line.split(’,’).map(s=>s?.trim()||’’);
const dayKey = DAYS.find(d=>d.toLowerCase()===day?.toLowerCase());
const si = parseInt(slot)-1;
if (!dayKey || isNaN(si) || si<0 || si>=CLASS_COUNT[dayKey]) return;
if (name) timetable[dayKey][si].name = name;
if (color) timetable[dayKey][si].color = color;
if (goodnotes) timetable[dayKey][si].goodnotes = goodnotes;
});
save(‘tt_days’, timetable);
document.getElementById(‘csvImport’).value = ‘’;
alert(‘Import successful!’);
updateClassStatus(); renderTaskSubjectRow();
}
function exportCSV() {
const lines = [];
DAYS.forEach(day => timetable[day].forEach((s,i) => {
if (s.name) lines.push(`${day},${i+1},${s.name},${s.color},${s.goodnotes||''}`);
}));
const blob = new Blob([lines.join(’\n’)],{type:‘text/csv’});
const url = URL.createObjectURL(blob);
Object.assign(document.createElement(‘a’),{href:url,download:‘timetable.csv’}).click();
URL.revokeObjectURL(url);
}

// ===================== INIT =====================
function init() {
document.body.setAttribute(‘data-theme’, State.theme);
document.querySelectorAll(’.theme-chip’).forEach(el => el.classList.toggle(‘active’, el.dataset.theme===State.theme));
document.getElementById(‘winterToggle’).classList.toggle(‘active’, State.winterMode);
document.getElementById(‘winterBanner’).classList.toggle(‘visible’, State.winterMode);
document.body.classList.toggle(‘winter-active’, State.winterMode);

updateDate(); updateClock(); fetchWeather(); renderNews();
renderMiniCalendar(); initMemo();
renderTaskSubjectRow(); renderTaskWidgetList();
renderSettingsGN();

// Task widget: Enter key on input
document.getElementById(‘taskNameInline’).addEventListener(‘keydown’, e => { if (e.key===‘Enter’) addTask(); });
document.getElementById(‘taskAddBtn’).addEventListener(‘click’, addTask);

document.getElementById(‘winterToggle’).addEventListener(‘click’, toggleWinter);
document.getElementById(‘settingsBtn’).addEventListener(‘click’, ()=>{ renderSettingsGN(); openModal(‘settings’); });
document.getElementById(‘timetableBtn’).addEventListener(‘click’, ()=>openPage(‘timetable’));
document.getElementById(‘goodnotesBtn’).addEventListener(‘click’, openGoodnotes);

document.querySelectorAll(’.modal-overlay’).forEach(el =>
el.addEventListener(‘click’, e=>{ if(e.target===el){el.classList.remove(‘active’);setTimeout(()=>el.style.display=‘none’,250);} })
);

setInterval(updateClock,   1000);
setInterval(fetchWeather,  10*60*1000);
setInterval(updateDate,    60*1000);
window.addEventListener(‘resize’, drawAnalogClock);
if (‘Notification’ in window && Notification.permission===‘default’) Notification.requestPermission();
}

document.addEventListener(‘DOMContentLoaded’, init);
