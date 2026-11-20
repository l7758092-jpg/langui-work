
/* LanGui 专业工作库 —— 按旧站（ChatGPT Sites 版 site-edit）源码逐项移植的离线单文件版。
   旧站：page.tsx / work-controls.tsx / month-ledger.tsx / social-media.tsx / year-navigation.tsx / lib/*.ts
   服务器数据库（D1）→ 内置 data.json + 浏览器 localStorage 覆盖层（只存改动）。 */
(function(){
'use strict';
var BASE = window.__LG_DATA__;
var KEY = 'langui-work-v3', LEGACY_KEY = 'langui-work-v2';
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }

/* ── lib/work-week.ts ── */
function todayShanghai(){
  var q = new URLSearchParams(location.search).get('today');
  if (q && validDate(q)) return q;
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
}
function shift(day, n){ var d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
function monday(day){ return shift(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7)); }
function validDate(s){ if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return isFinite(+d) && d.toISOString().slice(0,10) === s; }
function completionDay(r){
  if (!r) return null;
  if (r.completed) return r.completed;
  var date = r.date || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  var m = String(date).match(/^(\d{1,2})月(\d{1,2})日(?:下午|上午|\s.*)?$/);
  return m && r.month ? r.month.slice(0,4) + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0') : null;
}
function laterRound(r){
  var day = completionDay(r);
  return !!(r && r.done && day && r.planned && r.planned > day);
}
function weekendShanghai(day){
  if (!validDate(day)) return false;
  var name = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Shanghai', weekday:'short'}).format(new Date(day + 'T12:00:00+08:00'));
  return name === 'Sat' || name === 'Sun';
}
function formatShanghai(day){
  return new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'long', day:'numeric', weekday:'long'}).format(new Date(day + 'T00:00:00+08:00'));
}
function monthParam(value){ return /^\d{4}-(00|0[1-9]|1[0-2])$/.test(value || '') ? value : ''; }
function archiveMonth(){
  var mq = monthParam(params().get('month'));
  if (mq) return mq;
  var wq = params().get('week');
  if (validDate(wq)) return wq.slice(0,7);
  return M.today.slice(0,7);
}
function weekForMonth(month, today){
  if (month === today.slice(0,7)) return monday(today);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){ var first = month + '-01'; return shift(first, (8 - new Date(first + 'T00:00:00Z').getUTCDay()) % 7); }
  return monday(today);
}
function bucket(row, start, today){
  var end = shift(start, 6), day = row.planned || row.week;
  if (!day) return '';
  if (!row.done && (day < start || (today >= end && day <= end))) return 'carry';
  if (day >= start && day <= end) return row.planned ? 'dated' : 'undated';
  return '';
}
/* lib/schedule-update.ts */
function scheduleUpdate(previous, planned, week){
  week = week === undefined ? null : week;
  return { planned: planned, week: planned ? monday(planned) : week,
    originalPlan: (previous && previous.originalPlan != null) ? previous.originalPlan : ((previous && previous.planned && previous.planned !== planned) ? previous.planned : null) };
}
/* lib/weekly-order.ts */
function within(day, s, e){ return Boolean(day && day >= s && day <= e); }
function weeklySchedule(rows, start, end, currentWeek){
  return rows.filter(function(r){ return within(r.planned, start, end) || Boolean(start === currentWeek && !r.done && r.planned && r.planned < start) || Boolean(!r.done && !r.planned && r.week === start); })
  .sort(function(a, b){
    if (start === currentWeek){ var st = (Number(a.done) - Number(b.done)) || (Number(Boolean(b.urgent)) - Number(Boolean(a.urgent))); if (st) return st; }
    return (a.planned || '9999-99-99').localeCompare(b.planned || '9999-99-99') || a.id - b.id;
  });
}
/* lib/ledger-order.ts */
function dayKey(entry){
  var value = entry.date.trim();
  var m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/) || value.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  if (!m) return '9999-99-99';
  var y = m[1] || entry.month.slice(0,4), mo = m[2].padStart(2,'0'), d = m[3].padStart(2,'0');
  var date = new Date(y + '-' + mo + '-' + d + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0,10) === y + '-' + mo + '-' + d ? y + '-' + mo + '-' + d : '9999-99-99';
}
function ledgerSchedule(entries){
  return entries.map(function(entry, index){ return {entry:entry, index:index, key:dayKey(entry)}; })
    .sort(function(a, b){ return a.key.localeCompare(b.key) || a.index - b.index; }).map(function(i){ return i.entry; });
}
/* lib/social-order.ts */
function socialSchedule(items){
  return items.slice().sort(function(a, b){ return (a.publishDate || '9999-99-99').localeCompare(b.publishDate || '9999-99-99') || a.sequence - b.sequence || a.id - b.id; });
}

/* ── 数据：data.json（Ke 线上导出）→ 旧站数据库结构 ── */
var SHOOT_MAP = {'需要':'需要拍摄', '无需':'无需拍摄'};
function baseDb(data){
  var db = { work: [], events: [], snapshots: {}, priorities: {}, deadlines: {}, videoStages: {}, social: [], extra: {} };
  data.tasks.forEach(function(t){
    db.work.push({ id: t.id, month: t.month || (String(t.id).slice(0,4) + '-00'), date: t.dateText || '', title: t.title, progress: t.note || '', done: !!t.done,
      project: t.project || null, category: t.category || null, planned: t.plan || null, week: t.week || null, originalPlan: t.originalPlan || null,
      completed: t.completed || null, nextStep: t.next || null, review: t.review || null, requirements: t.requirements || null });
    (t.events || []).forEach(function(e){ db.events.push({ id: e.seq, taskId: t.id, day: e.day, progress: e.text, done: !!e.done, review: null, waiting: null, followUp: null }); });
    if (t.monthNotes && t.monthNotes.length) db.snapshots[t.id] = t.monthNotes[0];
    if (t.urgent) db.priorities[t.id] = true;
    if (t.deadline) db.deadlines[t.id] = t.deadline;
    if (t.stages || t.shoot){
      var s = t.stages || {};
      db.videoStages[t.id] = { taskId: t.id, script: s.script || null, footage: s.footage || null, shooting: t.shoot ? (SHOOT_MAP[t.shoot] || null) : null, editing: s.edit || null, delivery: s.deliver || null };
    }
    /* 旧站界面没有位置显示的字段，原样保留在数据里（导出备份会带上），不显示 */
    db.extra[t.id] = { initial: t.initial || null, handover: t.handover || null, src: t.src || null, monthNotes: t.monthNotes || [], hidden: !!t.hidden, history: t.history || [] };
  });
  data.social.forEach(function(s){
    db.social.push({ id: s.seq, month: s.month, sequence: s.seq, publishDate: s.date || null, title: s.title, content: s.content, task: s.work,
      note: s.note || null, status: (s.status && s.status !== '未记录') ? s.status : null, linkedTaskId: s.link || null });
  });
  return db;
}
/* 覆盖层：只存网页里做过的改动；内置数据更新时，没改过的记录自动用新数据 */
function emptySaved(){ return { v: 3, work: {}, addedEvents: [], social: {}, priorities: {}, deadlines: {}, videoStages: {} }; }
function loadSaved(){
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 3) return s; } catch (e) {}
  var fresh = emptySaved();
  /* 之前的新站（v2）若在这台浏览器里改过记录，迁移过来，避免丢失 */
  try {
    var old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (old && old.v === 2) migrateV2(old, fresh);
  } catch (e) {}
  return fresh;
}
function migrateV2(old, saved){
  var base = clone(BASE), byId = {};
  base.tasks.forEach(function(t){ byId[t.id] = t; });
  var removed = {}; (old.removed || []).forEach(function(id){ removed[id] = 1; });
  var touched = [];
  Object.keys(old.patches || {}).forEach(function(id){ if (byId[id]){ var p = old.patches[id]; for (var k in p) byId[id][k] = p[k]; touched.push(byId[id]); } });
  (old.added || []).forEach(function(t){ if (!removed[t.id]) touched.push(t); });
  if (!touched.length && !Object.keys(old.social || {}).length) return;
  var tmp = baseDb({ tasks: touched, social: [] });
  var baseEventIds = {}; base.tasks.forEach(function(t){ (t.events || []).forEach(function(e){ baseEventIds[e.seq] = 1; }); });
  tmp.work.forEach(function(w){ saved.work[w.id] = w; });
  tmp.events.forEach(function(e){ if (!baseEventIds[e.id]) saved.addedEvents.push(e); });
  touched.forEach(function(t){
    saved.priorities[t.id] = !!t.urgent; saved.deadlines[t.id] = t.deadline || null;
    if (tmp.videoStages[t.id]) saved.videoStages[t.id] = tmp.videoStages[t.id];
  });
  Object.keys(old.social || {}).forEach(function(sid){
    var p = old.social[sid], s = BASE.social.filter(function(x){ return x.id === sid; })[0]; if (!s) return;
    var row = {}; if ('date' in p) row.publishDate = p.date || null; if ('status' in p) row.status = (p.status && p.status !== '未记录') ? p.status : null;
    if ('note' in p) row.note = p.note || null; if ('link' in p) row.linkedTaskId = p.link || null;
    saved.social[s.seq] = row;
  });
  localStorage.setItem(KEY, JSON.stringify(saved));
}
function persist(){ localStorage.setItem(KEY, JSON.stringify(saved)); }
function currentDb(){
  var db = baseDb(BASE);
  var ids = {}; db.work.forEach(function(w, i){ ids[w.id] = i; });
  Object.keys(saved.work).forEach(function(id){
    var src = saved.work[id], w = clone(src);
    if (id in ids) {
      if (!Object.prototype.hasOwnProperty.call(src, 'requirements')) w.requirements = db.work[ids[id]].requirements || null;
      db.work[ids[id]] = w;
    } else db.work.push(w);
  });
  db.events = db.events.concat(clone(saved.addedEvents));
  Object.keys(saved.priorities).forEach(function(id){ if (saved.priorities[id]) db.priorities[id] = true; else delete db.priorities[id]; });
  Object.keys(saved.deadlines).forEach(function(id){ if (saved.deadlines[id]) db.deadlines[id] = saved.deadlines[id]; else delete db.deadlines[id]; });
  Object.keys(saved.videoStages).forEach(function(id){ db.videoStages[id] = clone(saved.videoStages[id]); });
  db.social = db.social.map(function(s){ var p = saved.social[s.id]; if (p) for (var k in p) s[k] = p[k]; return s; });
  return db;
}

/* ── 旧 /api/work 的保存逻辑（WorkEditor 用） ── */
function apiWork(data){
  var db = currentDb();
  var id = data.id, today = todayShanghai();
  var old = id != null ? db.work.filter(function(w){ return w.id === id; })[0] : null;
  if (id != null && !old) throw Error('记录不存在');
  var value = function(key, max){ max = max || 250; var v = data[key]; if (v == null) return ''; if (typeof v !== 'string' || v.length > max) throw Error('请检查输入长度'); return v.trim(); };
  var title = value('title'); if (!title) throw Error('请填写工作事项');
  var planned = value('planned', 10), completed = value('completed', 10), week = value('week', 10);
  if ([planned, completed, week].some(function(d){ return d && !validDate(d); }) || (week && monday(week) !== week)) throw Error('日期无效');
  var month = value('month', 7);
  if (month && !/^\d{4}-(00|0[1-9]|1[0-2])$/.test(month)) throw Error('月份无效');
  var review = value('review', 20);
  if (['', '待素材', '待反馈', '待验收'].indexOf(review) < 0) throw Error('反馈状态无效');
  var followUp = value('followUp', 10), waiting = value('waiting');
  if (followUp && !validDate(followUp)) throw Error('跟进日期无效');
  var sch = scheduleUpdate(old, planned || null, week || (!old && !planned ? monday(today) : null));
  var changes = { title: title, month: month || (old && old.month) || today.slice(0,7), date: value('date') || (old ? '' : today), progress: value('progress'), done: data.done === true,
    project: value('project') || null, category: value('category') || null, planned: sch.planned, week: sch.week, originalPlan: sch.originalPlan,
    completed: completed || null, nextStep: value('nextStep', 1000) || null, review: review || null, requirements: value('requirements', 4000) || null };
  var nextEventId = function(){ return db.events.concat(saved.addedEvents).reduce(function(m, e){ return Math.max(m, e.id); }, 0) + 1; };
  var addEvent = function(e){ e.id = nextEventId(); db.events.push(e); saved.addedEvents.push(e); };
  if (old){
    var prior = db.events.filter(function(e){ return e.taskId === old.id; }).sort(function(a, b){ return b.id - a.id; })[0];
    var row = Object.assign({ id: old.id }, changes);
    if (old.progress !== changes.progress || old.done !== changes.done || old.review !== changes.review || ((prior && prior.waiting) || '') !== waiting || ((prior && prior.followUp) || '') !== followUp){
      if (!prior && validDate(old.date)) addEvent({ taskId: old.id, day: old.date, progress: old.progress, done: old.done, review: old.review, waiting: null, followUp: null });
      addEvent({ taskId: old.id, day: today, progress: changes.progress, done: changes.done, review: changes.review, waiting: waiting || null, followUp: followUp || null });
    }
    saved.work[old.id] = row; persist(); return row;
  }
  var newId = db.work.reduce(function(m, w){ return Math.max(m, w.id); }, 0) + 1;
  var created = Object.assign({ id: newId }, changes);
  saved.work[newId] = created;
  addEvent({ taskId: newId, day: today, progress: changes.progress, done: changes.done, review: changes.review, waiting: waiting || null, followUp: followUp || null });
  persist(); return created;
}

var saved = loadSaved();
var EDIT = new URLSearchParams(location.search).get('edit') === '1';
var TODAY = todayShanghai();
var initialParams = new URLSearchParams(location.search);
var INITIAL_SELECTED = null, INITIAL_WEEK = null;
var ui = { copied: false, speechCopied: false, error: '', socialMonth: null, lastKey: '' };

/* ── page.tsx：把数据整理成页面要用的行 ── */
function model(){
  var db = currentDb();
  var events = db.events.slice().sort(function(a, b){ return a.day.localeCompare(b.day) || a.id - b.id; });
  var history = {};
  events.forEach(function(e){ (history[e.taskId] = history[e.taskId] || []).push(e); });
  var stored = db.work.slice().sort(function(a, b){ return a.id - b.id; });
  var rows = stored.filter(function(r){ return !/-00$/.test(r.month); }).map(function(r){
    return Object.assign({}, r, { deadline: db.deadlines[r.id] || null, urgent: !!db.priorities[r.id], history: history[r.id] || [], videoStage: db.videoStages[r.id] || null });
  });
  var today = TODAY, yearNow = Number(today.slice(0,4));
  var calendar = []; [2025, 2026, yearNow].filter(function(v, i, a){ return a.indexOf(v) === i; }).forEach(function(y){ for (var i = 1; i <= 12; i++) calendar.push(y + '-' + String(i).padStart(2,'0')); });
  var months = uniq(calendar.concat(rows.map(function(r){ return r.month; }), events.map(function(e){ return e.day.slice(0,7); })))
    .sort(function(a, b){ return (Number(/-00$/.test(a)) - Number(/-00$/.test(b))) || a.localeCompare(b); });
  var recordedDay = function(date, month){
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    var m = date.match(/^(\d{1,2})月(\d{1,2})日$/);
    return m ? month.slice(0,4) + '-' + m[1].padStart(2,'0') + '-' + m[2].padStart(2,'0') : null;
  };
  var ledgerEntries = [];
  rows.forEach(function(row){
    if (!row.history.some(function(e){ return e.day === recordedDay(row.date, row.month); }))
      ledgerEntries.push({ row: row, month: row.month, date: row.date, progress: db.snapshots[row.id] != null ? db.snapshots[row.id] : row.progress, key: 'task-' + row.id });
    row.history.forEach(function(e){ ledgerEntries.push({ row: row, month: e.day.slice(0,7), date: e.day, progress: e.progress, key: 'event-' + e.id }); });
  });
  var projects = uniq(rows.filter(function(r){ return r.project; }).map(function(r){ return r.project; })).sort();
  var years = uniq(months.map(function(v){ return v.slice(0,4); })).sort().reverse();
  var yearTargets = years.map(function(y){
    if (y === today.slice(0,4)) return { year: y, month: today.slice(0,7) };
    var found = null; months.forEach(function(k){ if (k.indexOf(y) === 0 && !/-00$/.test(k) && rows.some(function(r){ return r.month === k; })) found = k; });
    return { year: y, month: found || y + '-01' };
  });
  var deliveries = rows.filter(function(r){ return r.deadline && !r.done; }).sort(function(a, b){ return a.deadline.localeCompare(b.deadline) || a.id - b.id; });
  var byId = {}; db.work.forEach(function(w){ byId[w.id] = w; });
  var social = db.social.map(function(s){ var w = s.linkedTaskId != null ? byId[s.linkedTaskId] : null;
    return Object.assign({}, s, { linkedTitle: w ? w.title : null, linkedProgress: w ? w.progress : null, linkedDone: w ? !!w.done : null }); });
  return { rows: rows, months: months, ledgerEntries: ledgerEntries, projects: projects, years: years, yearTargets: yearTargets, deliveries: deliveries, social: social, today: today };
}
function uniq(a){ var s = {}, o = []; a.forEach(function(v){ if (!s[v]){ s[v] = 1; o.push(v); } }); return o; }

/* ── 地址栏状态（与旧站相同的参数：month q status project category week view socialMonth + #hash） ── */
function params(){ return new URLSearchParams(location.search); }
function push(url){ try { history.pushState(null, '', url); } catch (e) { fallbackUrl = String(url); } render(); }
var fallbackUrl = null;
function activeView(){ var h = location.hash; return h === '#social-media' ? 'social' : h === '#delivery' ? 'delivery' : h === '#weekly-record' ? 'weekly-record' : h === '#weekly-work-report' ? 'weekly-work-report' : h === '#weekly-report' ? 'weekly-report' : 'week'; }
function homeRequested(){ var p = params(); return !p.has('month') || p.get('view') === 'home'; }

/* ── 渲染 ── */
var M;
function render(){
  M = model();
  var p = params();
  if (INITIAL_SELECTED === null){
    var mq = initialParams.get('month');
    INITIAL_SELECTED = mq && M.months.indexOf(mq) >= 0 ? mq : M.today.slice(0,7);
    var wq = initialParams.get('week');
    INITIAL_WEEK = wq && validDate(wq) ? monday(wq) : monday(M.today);
  }
  var view = activeView(), home = homeRequested();
  document.querySelector('main.ledger').classList.toggle('planner-home', home);
  $('years').innerHTML = yearNav();
  var archiveYear = archiveMonth().slice(0,4);
  $('brandDate').textContent = '今天 · ' + formatShanghai(M.today);
  $('brandDate').setAttribute('datetime', M.today);
  $('total').textContent = M.rows.filter(function(r){ return (r.month || '').slice(0,4) === archiveYear; }).length;
  $('totalLabel').textContent = archiveYear + '年工作记录';
  $('hudTc').textContent = M.today.replace(/-/g, '.');
  document.querySelectorAll('.workspace-switch button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  var key = view + '|' + location.search;
  if (key !== ui.lastKey){ ui.copied = false; ui.speechCopied = false; ui.error = ''; ui.lastKey = key; }
  var html = '';
  if (view === 'social') html = socialBoard();
  else if (view === 'delivery') html = '<div id="delivery">' + deliveryOverview() + '</div>';
  else html = weekly(view, home);
  $('workspace').innerHTML = html;
  window.__LG_READY = true;
}

/* year-navigation.tsx */
function yearTargetHref(month){
  var p = params();
  if (!p.has('month') || p.get('view') === 'home') p.set('view', 'home');
  p.set('month', month);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) p.set('week', weekForMonth(month, M.today));
  ['q', 'status', 'project', 'category'].forEach(function(k){ p.delete(k); });
  return '?' + p.toString();
}
function yearNav(){
  var y = archiveMonth().slice(0,4);
  return M.yearTargets.map(function(t){ return '<a href="' + esc(yearTargetHref(t.month)) + '" data-nav="year" data-month="' + t.month + '"' + (y === t.year ? ' aria-current="page"' : '') + '>' + t.year + '年</a>'; }).join('');
}

/* video-stage-line.tsx */
var STEPS = [['script','脚本'], ['footage','素材'], ['shooting','拍摄'], ['editing','剪辑'], ['delivery','交付']];
function videoStageLine(stage){
  return '<div class="video-stages" aria-label="视频制作进度">' + STEPS.map(function(s){
    var status = stage[s[0]] || (s[0] === 'shooting' ? '待确认' : '未记录');
    var style = status === '已完成' ? 'done' : (status === '进行中' || status === '需要拍摄') ? 'active' : status === '等待中' ? 'waiting' : (status === '跳过' || status === '无需拍摄') ? 'skipped' : 'unknown';
    return '<div class="video-stage video-stage-' + style + '" aria-label="' + s[1] + '：' + esc(status) + '"><span class="video-stage-label">' + s[1] + '</span><span class="video-stage-state">' + (status === '已完成' ? '<span aria-hidden="true">✓ </span>' : '') + esc(status) + '</span></div>';
  }).join('') + '</div>';
}
/* WorkTag */
function workTag(row){
  var name = row.category || row.project; if (!name) return '';
  var hue = Array.from(name).reduce(function(h, c){ return (h * 31 + c.charCodeAt(0)) % 360; }, 0);
  return '<span class="work-tag" style="--tag-h:' + hue + '">' + esc(name) + '</span>';
}
function briefText(s, limit){
  var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  limit = limit || 48;
  return t.length > limit ? t.slice(0, limit) + '…' : t;
}
function hintTags(r){
  var bits = [];
  if (r.requirements && String(r.requirements).trim()) bits.push('<span class="planner-hint">含制作要求</span>');
  if (r.history && r.history.length) bits.push('<span class="planner-hint">历史 ' + r.history.length + ' 条</span>');
  return bits.length ? '<div class="planner-hints">' + bits.join('') + '</div>' : '';
}
function detailButton(){
  return '<button type="button" class="work-link detail-open" data-expand="1" aria-expanded="false">展开详情</button>';
}
function collapseTopButton(){
  return '<button type="button" class="inline-collapse-top" data-expand="1" hidden aria-expanded="true">收起</button>';
}
function previewHtml(preview){
  if (!preview || !preview.text) return '';
  return '<p class="planner-preview">' + (preview.label ? '<span>' + esc(preview.label) + '</span>' : '') + esc(preview.text) + '</p>';
}
function focusPreview(r, mode, day, ev){
  var useEvent = mode === 'yesterday' || (mode === 'today' && !(r.planned === day && (r.progress || r.nextStep)));
  if (useEvent){
    if (ev && ev.length && ev[0].progress) return { label: '最新进展', text: briefText(ev[0].progress) };
    return { label: '', text: '' };
  }
  if (r.progress && r.progress !== '已完成') return { label: '当前进度', text: briefText(r.progress) };
  if (r.nextStep) return { label: '下一步', text: briefText(r.nextStep) };
  return { label: '当前进度', text: r.done ? '已完成' : '未填写进度' };
}
function archiveLink(href, text, attrs){ return '<a href="' + esc(href) + '" data-nav="link"' + (attrs || '') + '>' + text + '</a>'; }
var WD = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
var CN = ['一','二','三','四','五'];

/* 独立周报。块和标签固定；项目状态、行状态和正文来自 weeklyReports，不在这里写死某一周的句子。 */
function weeklyReportRows(){
  var raw = BASE && BASE.weeklyReports;
  return Array.isArray(raw) ? raw : [];
}
function reportHref(day){
  var p = params();
  p.set('week', monday(day));
  return '?' + p.toString() + '#weekly-work-report';
}
function reportLine(line, blockType){
  var label = line && (line.label != null ? line.label : line.process);
  if (!line || label == null || line.text == null || !String(line.text).trim()) return '';
  label = String(label);
  var aspect = label === '横版' ? '16:9' : label === '竖版' ? '9:16' : '';
  var status = line.status ? '<span class="wreport-status">' + esc(line.status) + '</span>' : '';
  var ratio = aspect ? '<span class="wreport-aspect">' + aspect + '</span>' : '';
  var attendance = line.attendance ? ' data-attendance="' + esc(line.attendance) + '"' : '';
  return '<div class="wreport-line" data-block="' + esc(blockType || '') + '" data-label="' + esc(label) + '"' + attendance + '><span class="wreport-emoji">' + esc(line.emoji || '') + '</span><strong>' + esc(label) + '</strong>' + status + ratio + '<span class="wreport-colon">：</span><span class="wreport-text">' + esc(line.text) + '</span></div>';
}
function reportBlocks(blocks){
  return (blocks || []).map(function(block){
    var type = String(block && block.type || '');
    var lines = block && block.lines || [];
    if (type === '会议'){
      return ['已参加', '待参加'].map(function(kind){
        var group = lines.filter(function(line){ return line && line.attendance === kind; }).map(function(line){ return reportLine(line, type); }).join('');
        return group ? '<div class="wreport-attendance" data-attendance="' + kind + '"><h5>' + kind + '</h5><div class="wreport-lines">' + group + '</div></div>' : '';
      }).join('');
    }
    var body = lines.map(function(line){ return reportLine(line, type); }).join('');
    return body ? '<div class="wreport-lines" data-type="' + esc(type) + '">' + body + '</div>' : '';
  }).join('');
}
function reportProjects(list){
  return (list || []).map(function(project){
    var blocks = project.blocks;
    if (!blocks && project.lines) blocks = [{type: '制作', lines: project.lines}];
    var body = reportBlocks(blocks);
    if (!body) return '';
    var status = project.status ? '<span class="wreport-project-status">' + esc(project.status) + '</span>' : '';
    return '<article class="wreport-project"><h3 class="wreport-project-title"><span class="wreport-name">' + esc(project.name || '') + '</span><span class="wreport-emoji">' + esc(project.emoji || '') + '</span>' + status + '</h3>' + body + '</article>';
  }).join('');
}
function workReportSection(){
  var wq = params().get('week');
  if (wq && !validDate(wq)) return '<section class="wreport" id="weekly-work-report" data-state="invalid"><h2>工作汇报</h2><p class="wreport-empty">日期无效，没有改用其他周。</p></section>';
  var week = wq ? monday(wq) : monday(M.today);
  var end = shift(week, 6);
  var saved = weeklyReportRows().filter(function(row){ return row && validDate(row.week) && monday(row.week) === row.week; });
  var report = null;
  saved.forEach(function(row){ if (row.week === week) report = row; });
  var prev = shift(week, -7), next = shift(week, 7);
  var jumps = saved.map(function(row){ return row.week; }).filter(function(day, index, all){ return all.indexOf(day) === index; }).sort();
  var nav = '<nav class="wreport-nav" aria-label="历史工作汇报"><a class="wreport-jump" data-nav="link" href="' + esc(reportHref(prev)) + '">上一周 ' + esc(prev) + '</a><a class="wreport-jump" data-nav="link" href="' + esc(reportHref(next)) + '">下一周 ' + esc(next) + '</a>' +
    jumps.map(function(day){ return '<a class="wreport-jump" data-nav="link" href="' + esc(reportHref(day)) + '"' + (day === week ? ' aria-current="page"' : '') + '>' + esc(day) + '</a>'; }).join('') + '</nav>';
  var head = '<header><h2>工作汇报</h2><p class="wreport-range"><time datetime="' + week + '">' + esc(formatShanghai(week)) + '</time> 至 <time datetime="' + end + '">' + esc(formatShanghai(end)) + '</time></p><p class="wreport-tz">Asia/Shanghai</p></header>' + nav;
  if (!report) return '<section class="wreport" id="weekly-work-report" data-state="empty" data-week="' + week + '" data-end="' + end + '">' + head + '<p class="wreport-empty">' + esc(formatShanghai(week)) + '至' + esc(formatShanghai(end)) + '还没有工作汇报。</p></section>';
  var done = reportProjects(report.projects);
  var laterLines = reportProjects(report.followups);
  var later = laterLines || '<p class="wreport-empty">没有后续跟进</p>';
  return '<section class="wreport" id="weekly-work-report" data-state="ready" data-week="' + week + '" data-end="' + end + '">' + head +
    '<div class="wreport-done">' + done + '</div><h2 class="wreport-follow">后续工作跟进</h2><div class="wreport-later">' + later + '</div></section>';
}

/* work-controls.tsx → Weekly */
function weekly(view, home){
  var rows = M.rows, today = M.today;
  var wq = params().get('week');
  var week = validDate(wq) ? wq : weekForMonth(archiveMonth(), today);
  var end = shift(week, 6);
  var inWeek = function(d){ return d >= week && d <= end; };
  var currentWeek = monday(today);
  var dated = weeklySchedule(rows, week, end, currentWeek);
  var progressDate = function(r){ var d = r.history.filter(function(e){ return inWeek(e.day) && e.day <= today; }).map(function(e){ return e.day; }).sort(); return d.length ? d[d.length - 1] : null; };
  var updated = rows.filter(function(r){ return !r.done && dated.indexOf(r) < 0 && Boolean(progressDate(r)); });
  var pending = rows.filter(function(r){ return !r.done && !r.planned && r.week === week; });
  var review = rows.filter(function(r){ return pending.indexOf(r) < 0 && (r.review || r.progress === '已导出待验收'); });
  var yesterday = shift(today, -1);
  var eventsOn = function(r, day){ return (r.history || []).filter(function(e){ return e.day === day; }).sort(function(a, b){ return b.id - a.id; }); };
  var dayEntry = function(r, day, mode){
    var ev = eventsOn(r, day), doneDay = completionDay(r), plannedToday = r.planned === day, completedToday = !!(r.done && doneDay === day);
    var follow = !!(r.done && plannedToday && doneDay && doneDay < day);
    var badge = '';
    if (mode === 'today') badge = completedToday ? '已完成' : (plannedToday && !r.done ? '今日安排' : (follow ? '本轮安排' : '当天进展'));
    else if (completedToday) badge = '已完成';
    var html = '<div class="day-item-top"><strong>' + esc(r.title) + '</strong>' + (badge ? '<span class="daily-kind">' + badge + '</span>' : '') + collapseTopButton() + '</div>' +
      previewHtml(focusPreview(r, mode, day, ev)) +
      (follow ? '<p class="day-key">此前已完成 ' + esc(doneDay) + '</p>' : '') +
      '<div class="planner-foot">' + hintTags(r) + detailButton() + '</div>' +
      inlineDetailHtml(r, mode, day);
    return { id: r.id, title: r.title, plannedToday: plannedToday, latest: ev.length ? ev[0].id : 0, html: html };
  };
  var yesterdayItems = [];
  rows.forEach(function(r){
    if (eventsOn(r, yesterday).length || (r.done && completionDay(r) === yesterday)) yesterdayItems.push(dayEntry(r, yesterday, 'yesterday'));
  });
  yesterdayItems.sort(function(a, b){ return (b.latest - a.latest) || a.id - b.id; });
  var todayItems = [];
  rows.forEach(function(r){
    var ev = eventsOn(r, today), future = r.planned && r.planned > today;
    if (r.planned === today || (ev.length && !future)) todayItems.push(dayEntry(r, today, 'today'));
  });
  todayItems.sort(function(a, b){ return (Number(b.plannedToday) - Number(a.plannedToday)) || (b.latest - a.latest) || a.id - b.id; });
  var activity = [];
  rows.forEach(function(r){
    var ev = r.history.filter(function(e){ return inWeek(e.day); });
    var last = ev[ev.length - 1];
    if (last){ activity.push({ title: r.title, done: last.done, progress: ev.map(function(e){ return e.day + ' ' + e.progress; }).join(' → ') }); return; }
    var day = completionDay(r);
    if (r.done && day && inWeek(day) && (!r.history.length || r.completed)) activity.push({ title: r.title, done: r.done, progress: day + ' ' + r.progress });
  });
  activity.sort(function(a, b){ return a.progress.localeCompare(b.progress); });
  var speech = speechText(activity);
  var viewDate = function(r){ return updated.indexOf(r) >= 0 ? progressDate(r) : r.planned; };
  var weekItems = rows.filter(function(r){ return dated.indexOf(r) >= 0 || (!r.planned && r.week === week) || (r.done && completionDay(r) && inWeek(completionDay(r))); })
    .sort(function(a, b){ var d = function(r){ return viewDate(r) || completionDay(r); }; return (d(a) || '9999-99-99').localeCompare(d(b) || '9999-99-99') || a.id - b.id; });
  var dateLabel = function(v){ return v.slice(5).replace('-', ' / '); };
  var weekNumber = Math.floor((Number(week.slice(8,10)) - 1) / 7);
  var weekTitle = Number(week.slice(5,7)) + '月第' + CN[weekNumber] + '周';
  var selectedMonth = week.slice(0,7), firstOfMonth = selectedMonth + '-01';
  var firstMonday = shift(firstOfMonth, (8 - new Date(firstOfMonth + 'T00:00:00Z').getUTCDay()) % 7);
  var monthWeeks = [0,1,2,3,4].map(function(i){ return shift(firstMonday, i * 7); }).filter(function(d){ return d.slice(0,7) === selectedMonth; });
  var year = Number(today.slice(0,4));
  var years = uniq([year - 1, year, year + 1, Number(week.slice(0,4))].concat(rows.map(function(r){ return Number(r.month.slice(0,4)); })))
    .filter(function(v){ return Number.isInteger(v) && v >= 1900 && v <= 2100; }).sort(function(a, b){ return a - b; });
  var weekHref = function(day){ var p = params(); p.set('week', day); if (p.has('month')) p.set('view', 'home'); return '?' + p.toString(); };
  var range = week.slice(5).replace('-', '/') + ' — ' + end.slice(5).replace('-', '/');
  var out = '';

  var show = function(r){
    var displayDate = viewDate(r), isUpdate = updated.indexOf(r) >= 0, last = r.history[r.history.length - 1];
    var dateBits = [];
    if (isUpdate && r.planned) dateBits.push('<p class="planner-original">' + (r.date.indexOf('交付') >= 0 ? '计划交付：' : '当前计划：') + esc(r.planned) + '</p>');
    if (r.deadline && r.deadline !== r.planned) dateBits.push('<p class="planner-original">计划交付：' + esc(r.deadline) + '</p>');
    if (r.originalPlan && r.originalPlan !== r.planned) dateBits.push('<p class="planner-original">原计划：' + esc(r.originalPlan) + '</p>');
    return '<li class="planner-card" data-expand-key="schedule:' + r.id + '"><div class="planner-card-top"><span class="' + (displayDate ? 'planner-date' : 'planner-date planner-date-empty') + '">' +
      (displayDate ? '<time datetime="' + displayDate + '">' + dateLabel(displayDate) + '</time><small>' + WD[new Date(displayDate + 'T00:00:00Z').getUTCDay()] + '</small>' : '日期未定') + '</span><div>' +
      workTag(r) + (isUpdate ? '<span class="planner-carry-label">本周进展</span>' : '') + (r.urgent && !r.done ? '<span class="planner-urgent">紧急</span>' : '') +
      (!isUpdate && r.planned && r.planned < week && !r.done && week === currentWeek ? '<span class="planner-carry-label">待继续</span>' : '') +
      (r.review ? '<span class="work-tag">' + esc(r.review) + '</span>' : '') + (laterRound(r) ? '<span class="planner-carry-label">此前已完成</span>' : (r.done ? '<span class="planner-done">已完成</span>' : '')) +
      collapseTopButton() + '</div></div>' +
      '<h4>' + esc(r.title) + '</h4>' + (r.videoStage ? videoStageLine(r.videoStage) : '') +
      (r.project ? archiveLink('?project=' + encodeURIComponent(r.project) + '#archive', esc(r.project)) : '') +
      (last && last.waiting ? '<p class="planner-oneline"><span>等待</span>' + esc(briefText(last.waiting, 36)) + '</p>' : '') +
      (last && last.followUp ? '<p class="planner-oneline"><span>下次跟进</span>' + esc(last.followUp) + '</p>' : '') +
      previewHtml(focusPreview(r, 'schedule', '', [])) +
      (dateBits.length ? '<div class="planner-dates">' + dateBits.join('') + '</div>' : '') +
      '<div class="planner-foot">' + hintTags(r) +
      '<div class="planner-card-actions">' + detailButton() +
      (EDIT ? '<button type="button" class="work-link" data-edit="' + r.id + '" data-week="' + week + '">详情／更新</button>' : '') + '</div></div>' +
      inlineDetailHtml(r, 'schedule', '') + '</li>';
  };

  if (view === 'week' && home){
    out += '<section class="planner-week" id="week"><div class="planner-hero"><div class="planner-hero-main"><div><p class="planner-kicker">PRODUCTION TIMELINE</p><h2>' + weekTitle + '</h2><p class="planner-range"><time datetime="' + week + '">' + week + '</time> <span>—</span> <time datetime="' + end + '">' + end + '</time></p></div></div>';
    out += '<div class="planner-week-strip" aria-label="本周日期">' + ['一','二','三','四','五','六','日'].map(function(d, i){ var date = shift(week, i);
      return '<div' + (date === today ? ' aria-current="date"' : '') + '><span>周' + d + '</span><strong>' + date.slice(8) + '</strong><small aria-hidden="true">0' + (i + 1) + '</small>' + (dated.some(function(r){ return r.planned === date; }) ? '<i aria-label="有计划任务"></i>' : '') + '</div>'; }).join('') + '</div>';
    out += '<nav class="work-actions planner-nav week-picker" aria-label="按月份和周数查看"><label class="week-month"><span>月份</span><select aria-label="选择月份" id="weekMonthSelect">' +
      years.map(function(v){ var o = ''; for (var i = 1; i <= 12; i++){ var m = v + '-' + String(i).padStart(2,'0'); o += '<option value="' + m + '"' + (m === selectedMonth ? ' selected' : '') + '>' + v + '年' + i + '月</option>'; } return o; }).join('') + '</select></label>' +
      monthWeeks.map(function(day, i){ return archiveLink(weekHref(day), '第' + CN[i] + '周', day === week ? ' aria-current="page"' : ''); }).join('') + '</nav></div>';
    out += '<p role="alert">' + esc(ui.error) + '</p>';
    if (EDIT) out += '<div class="edit-bar"><span>维护模式</span><button class="work-button" data-new="1" data-week="' + week + '">＋ 新增工作</button><button class="work-link" data-act="export">导出备份</button><button class="work-link" data-act="import">导入备份</button></div>';
    out += '<div class="planner-board planner-week-overview">';
    out += '<section class="planner-group planner-week-contents"><h3>本周工作内容</h3><div class="week-status-groups">' + [{label:'未完成', done:false}, {label:'已完成', done:true}].map(function(g){
      var items = weekItems.filter(function(r){ return laterRound(r) ? !g.done : r.done === g.done; });
      return '<section class="week-status-group ' + (g.done ? 'is-done' : 'is-open') + '" aria-label="' + g.label + '"><h4><span>' + (g.done ? '✓' : '●') + '</span>' + g.label + '<small>' + items.length + ' 项</small></h4>' +
        (items.length ? '<ul class="planner-week-list">' + items.map(function(r){ var d = viewDate(r) || completionDay(r); var doneDay = completionDay(r);
          var checked = r.done && doneDay && inWeek(doneDay) && !laterRound(r);
          return '<li data-expand-key="week:' + r.id + '"><button type="button" class="week-item-btn" data-expand="1" aria-expanded="false"' + (laterRound(r) ? ' title="此前已完成，当前日期是新安排"' : '') + '><strong>' + esc(r.title) + '</strong><small>' + (d ? d.slice(5).replace('-', '月') + '日' : '') + '</small><span class="week-row-end">' + (checked ? '<span class="week-done-check" aria-label="已完成">✓</span>' : '') + '<span class="week-detail-cue">展开</span></span></button>' + inlineDetailHtml(r, 'week', '') + '</li>'; }).join('') + '</ul>' : '<p class="week-status-empty">暂无' + g.label + '工作</p>') + '</section>';
    }).join('') + '</div></section>';
    out += '<section class="planner-group planner-week-schedule"><h3>本周排期 <small>' + dated.length + ' 项</small></h3>' + (dated.length ? '<ul class="planner-grid">' + dated.map(show).join('') + '</ul>' : '<p class="planner-empty">暂无排期</p>') + '</section>';
    var liveYear = archiveMonth().slice(0,4) === today.slice(0,4);
    var todayBody = todayItems.length ? '<ul class="daily-list">' + todayItems.map(function(it){
      return '<li data-expand-key="today:' + it.id + ':' + today + '">' + it.html + '</li>'; }).join('') + '</ul>' : '<p class="planner-empty">今天暂无工作安排</p>';
    var yesterdayBody = yesterdayItems.length ? '<ul class="yesterday-list">' + yesterdayItems.map(function(it){
      return '<li data-expand-key="yesterday:' + it.id + ':' + yesterday + '">' + it.html + '</li>'; }).join('') + '</ul>' : '<p class="planner-empty">' + (weekendShanghai(yesterday) ? '休息' : '昨天暂无工作记录') + '</p>';
    var todayMeta = today.slice(5).replace('-', '/') + ' · ' + todayItems.length + ' 项';
    var yesterdayMeta = yesterday.slice(5).replace('-', '/') + ' · ' + yesterdayItems.length + ' 项';
    if (!liveYear){
      todayMeta = '不随档案年变化';
      yesterdayMeta = '不随档案年变化';
      todayBody = '<p class="planner-empty">今天是' + formatShanghai(today) + '</p>';
      yesterdayBody = '<p class="planner-empty">所选' + archiveMonth().slice(0,4) + '年档案，与今天分开</p>';
    }
    out += '<section class="planner-group planner-today"><h3>今天 <small>' + todayMeta + '</small></h3>' + todayBody + '</section>';
    out += '<section class="planner-group planner-yesterday"><h3>昨天做了什么 <small>' + yesterdayMeta + '</small></h3>' + yesterdayBody + '</section>';
    out += '</div></section>';
  }
  if (view === 'weekly-record'){
    ui.copyText = ['本周做了什么（' + week + ' — ' + end + '）'].concat(activity.map(function(a){ return a.title + ' · ' + a.progress; })).join('\n');
    out += '<section class="planner-group weekly-recap"><div class="recap-toggle"><span>本周做了什么</span><small>' + weekTitle + ' · ' + range + ' · ' + activity.length + ' 项</small></div><div class="weekly-actual-list">' +
      (activity.length ? activity.map(function(it){ var m = it.progress.match(/^(\d{4}-\d{2}-\d{2})\s*/); var desc = m ? it.progress.slice(m[0].length) : it.progress;
        return '<div class="weekly-actual-row"><time>' + (m ? m[1].slice(5).replace('-', '/') : '') + '</time><strong>' + esc(it.title) + '</strong><div><p>' + esc(desc) + '</p></div></div>'; }).join('') : '<p class="weekly-actual-empty">暂无实际工作记录</p>') +
      '</div><div class="recap-footer"><button class="work-link" aria-live="polite" data-act="copy-record">' + (ui.copied ? '已复制' : '复制工作记录') + '</button></div><p role="alert">' + esc(ui.error) + '</p></section>';
  }
  if (view === 'weekly-report'){
    ui.speech = speech.text;
    out += '<section class="planner-group weekly-recap weekly-report-panel"><div class="recap-toggle"><span>整体汇报</span><small>' + weekTitle + ' · ' + range + '</small></div><div class="weekly-speech"><div class="weekly-speech-header"><div class="speech-heading"><span>周会 · 工作汇报</span><h3>整体汇报词</h3></div><button class="work-link" aria-live="polite" data-act="copy-speech">' + (ui.speechCopied ? '已复制' : '复制汇报词') + '</button></div><div class="weekly-speech-text">' +
      speech.text.split('\n\n').map(function(p){ return '<p>' + speech.emphasize(p) + '</p>'; }).join('') + '</div></div><p role="alert">' + esc(ui.error) + '</p></section>';
  }
  if (view === 'weekly-work-report') out += workReportSection();
  if (view === 'week') out += monthLedger(home);
  return out;
}

/* 整体汇报词（旧站原样：已知条目用固定句子，其余按「名称方面，说明」） */
var KNOWN = {
 "2026年香港餐会感谢视频":{note:"制作感谢大家版本，完成英文字幕。",sentence:"完成了2026年香港餐会感谢视频的感谢大家版本和英文字幕。",group:"视频制作"},
 "南宁康复宣传片筹备":{note:"梳理拍摄方向，查找并整理参考素材和项目文件夹。",sentence:"梳理了南宁康复宣传片的拍摄方向，整理参考素材和项目文件夹。",group:"视频制作"},
 "感恩节视频构思":{note:"确认视频主题，讨论故事与情绪结构。",sentence:"确认了感恩节视频主题，讨论了故事和情绪结构。",group:"视频制作"},
 "感恩节视频前期策划":{note:"完成创意构思、整片脚本及各项目拍摄分工。",sentence:"完成了感恩节视频的创意构思、整片脚本和各项目拍摄分工。",group:"视频制作"},
 "感恩节素材通知制作":{note:"整理并保存各项目素材收集表及拍摄要求。",sentence:"整理并保存了感恩节视频各项目的素材收集表和拍摄要求。",group:"视频制作"},
 "感恩节采访问题":{note:"确定七个项目统一使用8道采访问题，并讨论采访人数。",sentence:"确定感恩节视频七个项目使用统一的8道采访问题，并讨论了采访人数。",group:"视频制作"},
 "精达报告资料查找":{note:"查找2025年报告，核对2026年上半年脚本及素材位置。",sentence:"查找了2025年精达报告，并核对2026年上半年脚本和素材的位置。",group:"视频制作"},
 "《你点亮我的生命》PPT制作":{note:"制作并调整中英版PPT与会议讲稿，查找《让爱走动》中英字幕版本。",sentence:"制作并调整了《你点亮我的生命》中英版PPT和会议讲稿，并查找《让爱走动》的中英字幕版本。",group:"会议及办公"},
 "《你点亮我的生命》PPT":{note:"已完成会议分享",sentence:"完成了《你点亮我的生命》的会议分享。",group:"会议及办公"},
 "9—10月采购报销核查":{note:"核对9月采购表、顺丰票据及10月资料；76元是否另行报销待确认。",sentence:"核对了9月采购表、顺丰票据和10月资料，76元是否另行报销还需确认。",group:"会议及办公"},
 "工作库功能规划":{note:"研究任务排期及卡片形式，整理工作库功能需求。",sentence:"研究了工作库的任务排期与卡片形式，整理功能需求。",group:"工作库"},
 "年度工作档案整理":{note:"整理2025、2026年工作记录并按月归档。",sentence:"整理了2025年和2026年的工作记录，并按月归档。",group:"工作库"},
 "香港餐会感谢视频整理":{note:"查找并整理2026年香港餐会感谢视频原版。",sentence:"查找并整理了2026年香港餐会感谢视频原版。",group:"视频制作"},
 "工作库页面优化":{note:"调整本周工作展示、工作记录和月度台账界面。",sentence:"调整了本周工作展示、工作记录和月度台账界面。",group:"工作库"}
};
var SPEECH_ORDER = ["2026年香港餐会感谢视频","香港餐会感谢视频整理","南宁康复宣传片筹备","感恩节视频构思","感恩节视频前期策划","感恩节素材通知制作","感恩节采访问题","精达报告资料查找","《你点亮我的生命》PPT制作","《你点亮我的生命》PPT","9—10月采购报销核查","工作库功能规划","年度工作档案整理","工作库页面优化"];
function speechText(activity){
  var groups = {};
  var items = activity.slice().sort(function(a, b){ var ai = SPEECH_ORDER.indexOf(a.title), bi = SPEECH_ORDER.indexOf(b.title); return (ai < 0 ? 10000 : ai) - (bi < 0 ? 10000 : bi); });
  items.forEach(function(it){
    var detail = it.progress.replace(/^\d{4}-\d{2}-\d{2}\s*/, '').trim(), known = KNOWN[it.title];
    var group = known && known.note === detail ? known.group : '其他工作';
    var sentence = known && known.note === detail ? known.sentence : it.title + '方面，' + (detail || '已记录相关工作') + (/[。！？]$/.test(detail) ? '' : '。');
    (groups[group] = groups[group] || []).push(sentence);
  });
  var text = activity.length ? ['这周我主要做了以下工作。'].concat(['视频制作','会议及办公','工作库','其他工作'].filter(function(g){ return groups[g]; }).map(function(g, i){ return '第' + ['一','二','三','四'][i] + '，' + g + '方面，' + groups[g].join(''); })).join('\n\n') : '本周暂时没有工作记录。';
  var names = uniq(activity.map(function(a){ return a.title; }).concat(["2026年香港餐会感谢视频","香港餐会感谢视频","南宁康复宣传片","南宁康复中心宣传片","感恩节视频","2025年精达报告","《你点亮我的生命》","9月采购表","顺丰票据","工作库"])).filter(Boolean).sort(function(a, b){ return b.length - a.length; });
  var pattern = names.length ? new RegExp('(' + names.map(function(n){ return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g') : null;
  var emphasize = function(t){ return pattern ? t.split(pattern).map(function(part){ return names.indexOf(part) >= 0 ? '<mark class="speech-project">' + esc(part) + '</mark>' : esc(part); }).join('') : esc(t); };
  return { text: text, emphasize: emphasize };
}

/* month-ledger.tsx */
function description(v){ var t = (v || '').trim(); return /^(?:已完成|完成|\d+(?:\.\d+)?%?)$/.test(t) ? '' : t; }
function monthLabel(v){ return /-00$/.test(v) ? v.slice(0,4) + '年 · 月份待核' : v.slice(0,4) + '年' + Number(v.slice(5)) + '月'; }
function ledgerSelection(){
  var p = params();
  return { month: archiveMonth(), crossMonth: !p.has('month'), filters: { q: p.get('q') || '', status: p.get('status') || '', project: p.get('project') || '', category: p.get('category') || '' } };
}
function ledgerChangeUrl(month, filters, embedded){
  var url = new URL(location.href);
  url.searchParams.set('month', month);
  ['q', 'status', 'project', 'category'].forEach(function(k){ if (filters[k]) url.searchParams.set(k, filters[k]); else url.searchParams.delete(k); });
  if (!(filters && (filters.q || filters.status || filters.project || filters.category)) && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) url.searchParams.set('week', weekForMonth(month, M.today));
  if (homeRequested()) url.searchParams.set('view', 'home');
  else if (url.searchParams.get('view') === 'home') url.searchParams.delete('view');
  return url;
}
function monthLedger(){
  var sel = ledgerSelection(), selected = sel.month, f = sel.filters;
  var month = f.project && sel.crossMonth ? '' : selected;
  var entries = M.ledgerEntries.filter(function(e){ return e.month === selected; });
  var categories = uniq(M.rows.filter(function(r){ return r.category; }).map(function(r){ return r.category; })).sort();
  var query = f.q.trim().toLowerCase();
  var visible = ledgerSchedule((f.project && !month ? M.ledgerEntries : entries).filter(function(e){ var row = e.row;
    return (!query || (row.title + ' ' + row.progress + ' ' + (row.requirements || '') + ' ' + (row.project || '')).toLowerCase().indexOf(query) >= 0) && (!f.project || row.project === f.project) && (!f.category || row.category === f.category) &&
      (f.status === 'done' ? row.done : f.status === 'open' ? !row.done : !f.status || row.progress === f.status); }));
  var latest = {}; visible.forEach(function(e){ latest[e.row.id] = e.key; });
   var year = selected.slice(0,4);
  var yearMonths = [1,2,3,4,5,6,7,8,9,10,11,12].map(function(n){ return year + '-' + String(n).padStart(2,'0'); });
  var yearRows = M.rows.filter(function(r){ return (r.month || '').slice(0,4) === year; }).length;
  var count = function(v){ return M.ledgerEntries.filter(function(e){ return e.month === v; }).length; };
  var progressOptions = uniq(M.rows.map(function(r){ return r.progress; }).filter(Boolean)).filter(function(p){ return p.length <= 24 && p !== '已完成' && p !== '未标完成'; }).sort();
  var opt = function(value, label, cur){ return '<option value="' + esc(value) + '"' + (value === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
  var o = '<h2 class="work-month-title" id="archive">月度工作记录</h2><div class="ledger-summary" aria-label="当月概览"><div class="ledger-period"><small>当前档案</small><strong>' + monthLabel(selected) + '</strong></div>' +
    '<div><small>当月记录</small><strong>' + entries.length + '</strong></div><div><small>已完成</small><strong>' + entries.filter(function(e){ return e.row.done; }).length + '</strong></div><div><small>未标完成</small><strong>' + entries.filter(function(e){ return !e.row.done; }).length + '</strong></div></div>';
   o += '<div class="ledger-layout"><nav class="ledger-nav month-archive" aria-label="月份"><div class="month-archive-head"><span>月度档案</span><strong>' + year + '</strong><small>' + (yearRows ? '该年工作索引' : '该年没有工作记录') + '</small></div><div class="month-archive-groups">' +
    [1,2,3,4].map(function(q){ return '<div class="month-quarter"><div class="month-quarter-label"><b>Q' + q + '</b><span>第' + ['一','二','三','四'][q - 1] + '季度</span></div><div class="month-tiles">' +
      yearMonths.filter(function(v){ return Math.ceil(Number(v.slice(5)) / 3) === q; }).map(function(v){
        return '<a href="?month=' + v + '#archive" data-nav="month" data-month="' + v + '" aria-label="' + monthLabel(v) + '，' + count(v) + '条记录"' + (v === selected ? ' aria-current="page"' : '') + '><strong>' + Number(v.slice(5)) + '<small>月</small></strong><span>' + count(v) + '<span class="month-unit"> 条</span></span></a>'; }).join('') + '</div></div>'; }).join('') +
    M.months.filter(function(v){ return v.indexOf(year) === 0 && /-00$/.test(v); }).map(function(v){ return '<a class="month-unknown" href="?month=' + v + '#archive" data-nav="month" data-month="' + v + '"' + (v === selected ? ' aria-current="page"' : '') + '><span>月份待核</span><span>' + count(v) + ' 条</span></a>'; }).join('') + '</div></nav>';
  o += '<section class="ledger-panel"><div class="ledger-title work-heading"><div><h2>' + (f.project && !month ? '跨月项目：' + esc(f.project) : monthLabel(selected) + '工作') + '</h2><p>' + visible.length + ' 条记录</p></div></div>';
  o += '<form class="ledger-filter" id="ledgerFilter"><input type="search" aria-label="搜索当月任务" name="q" value="' + esc(f.q) + '" placeholder="搜索当月任务">' +
    '<label class="ledger-select"><span>项目</span><select aria-label="项目" name="project">' + opt('', '全部项目', f.project) + M.projects.map(function(p){ return opt(p, p, f.project); }).join('') + '</select></label>' +
    '<label class="ledger-select"><span>分类</span><select aria-label="分类" name="category">' + opt('', '全部分类', f.category) + categories.map(function(c){ return opt(c, c, f.category); }).join('') + '</select></label>' +
    '<label class="ledger-select"><span>进度</span><select aria-label="进度" name="status">' + opt('', '全部进度', f.status) + opt('done', '已完成', f.status) + opt('open', '未标完成', f.status) + progressOptions.map(function(p){ return opt(p, p, f.status); }).join('') + '</select></label>' +
    '<button type="submit">筛选</button></form>';
  if (visible.length){
    o += '<div class="ledger-scroll"><table><thead><tr><th scope="col">日期</th><th scope="col">工作任务</th><th scope="col">说明</th><th scope="col" class="ledger-completion">完成情况</th></tr></thead><tbody>' + visible.map(function(e){ var row = e.row;
      var ev = !row.done && e.key === latest[row.id] && (row.planned || row.originalPlan || row.deadline) ? '<small class="ledger-event">' + (row.planned ? '工作日：' + row.planned : row.originalPlan ? '工作日待安排' : '') + (row.deadline ? ((row.planned || row.originalPlan) ? ' · ' : '') + '交付：' + row.deadline : '') + '</small>' : '';
      return '<tr><td>' + esc(e.date) + '</td><td>' + esc(row.title) + ' ' + (row.project ? archiveLink('?project=' + encodeURIComponent(row.project) + '#archive', esc(row.project)) : '') + ' ' + workTag(row) + ev +
        (EDIT && e.key === latest[row.id] ? ' <button class="work-link" data-edit="' + row.id + '">详情／更新</button>' : '') + '</td><td>' +
        (description(e.progress) ? esc(description(e.progress)) : description(row.progress) ? esc(description(row.progress)) : esc(row.title) + '<small class="ledger-event">原表未记具体说明</small>') +
        '</td><td class="ledger-completion">' + (row.done && completionDay(row) && completionDay({ completed: null, date: e.date, month: row.month }) === completionDay(row) ? '<span role="img" aria-label="已完成" class="ledger-tick">✓</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  } else o += '<p class="ledger-empty">' + (entries.length ? '没有符合筛选条件的记录' : (yearRows ? '这个月没有工作记录。' : year + '年没有工作记录。')) + '</p>';
  o += '</section></div>';
  return o;
}

/* social-media.tsx */
function socialBoard(){
  var items = M.social;
  var displayMonth = function(it){ return (it.publishDate && it.publishDate.slice(0,7)) || it.month; };
  var months = uniq(items.reduce(function(a, it){ return a.concat([it.month, displayMonth(it)]); }, [])).sort().reverse();
  var q = params().get('socialMonth');
  if (q && months.indexOf(q) >= 0) ui.socialMonth = q;
  if (!ui.socialMonth || months.indexOf(ui.socialMonth) < 0) ui.socialMonth = months[0] || '';
  var month = ui.socialMonth;
  var shown = socialSchedule(items.filter(function(it){ return displayMonth(it) === month; }));
  var scheduled = shown.filter(function(it){ return it.publishDate; }).length;
  var tg = items.filter(function(it){ return it.title === '感恩节特别视频'; })[0];
  var tgDate = tg && tg.publishDate ? Number(tg.publishDate.slice(5,7)) + '月' + Number(tg.publishDate.slice(8,10)) + '日' : '日期待定';
  var md = function(d){ return Number(d.slice(5,7)) + '月' + Number(d.slice(8,10)) + '日'; };
  var o = '<section class="social-board" id="social-media" aria-labelledby="social-title"><div class="social-heading"><div><p class="social-kicker">SOCIAL MEDIA / MONTHLY PLAN</p><h2 id="social-title">社交媒体月份任务</h2><p>SLM 内容制作安排</p></div>' +
    '<label class="social-month">月份<select id="socialMonthSelect">' + months.map(function(v){ return '<option value="' + v + '"' + (v === month ? ' selected' : '') + '>' + v.slice(0,4) + '年' + Number(v.slice(5)) + '月</option>'; }).join('') + '</select></label></div>';
  o += '<div class="social-summary" aria-label="任务统计"><div><strong>' + shown.length + '</strong><span>内容主题</span></div><div><strong>' + scheduled + '</strong><span>已安排发布日期</span></div><div><strong>' + (shown.length - scheduled) + '</strong><span>发布日期待定</span></div>' + (month === '2026-11' ? '<div><strong>5</strong><span>社交媒体平台</span></div>' : '') + '</div>';
  o += '<p class="social-note">日期为计划发布日期；内容主题数量不等于视频数量。</p><div class="social-list-head"><span>发布日期</span><span>内容主题</span><span>制作内容与工作任务</span></div><ol class="social-list">' +
    shown.map(function(it, i){ return '<li><div class="social-date"><span>' + String(i + 1).padStart(2,'0') + '</span><strong>' + (it.publishDate ? md(it.publishDate) : '日期待定') + '</strong></div>' +
      '<div class="social-topic"><h3>' + esc(it.title) + '</h3>' + (it.linkedTaskId ? '<span class="social-linked">关联工作：' + esc(it.linkedTitle || '工作库任务') + '</span>' : '') + ((it.linkedDone || it.status) ? '<span class="social-status">' + (it.linkedDone ? '已完成' : esc(it.status)) + '</span>' : '') + '</div>' +
      '<div class="social-detail"><p><span>制作内容</span>' + esc(it.content) + '</p><p><span>工作任务</span>' + esc(it.task) + '</p>' + (it.linkedProgress ? '<p class="social-progress"><span>最新进展</span>' + esc(it.linkedProgress) + '</p>' : '') + (it.note ? '<p class="social-progress"><span>备注</span>' + esc(it.note) + '</p>' : '') + '</div></li>'; }).join('') + '</ol>';
  if (month === '2026-11') o += '<details class="social-extra"><summary>工作类型与重点</summary><div class="social-extra-grid"><div><strong>视频制作</strong><p>项目故事、康复服务、教育支持、职业培训、感恩节视频、全球捐赠日宣传、活动记录</p></div><div><strong>平面设计</strong><p>年报数据轮播图、项目宣传图片、FAQ轮播图、节日活动宣传图</p></div><div><strong>内容策划</strong><p>18项内容主题策划、视频脚本、社交媒体文案、素材整理</p></div><div><strong>重点工作</strong><p>' + tgDate + '感恩节特别视频、12月1日全球捐赠日宣传、各项目日常内容制作、团队活动视频制作</p></div></div></details>';
  o += '<div class="social-bottom">' + (month === '2026-11' ? '<div><strong>发布平台</strong><span>Facebook · Instagram · TikTok · YouTube · LinkedIn</span></div>' : '') + '<p>具体视频、图片及轮播图数量根据实际制作要求确定。</p></div></section>';
  return o;
}

/* page.tsx 成片交付安排 */
function deliveryOverview(){
  var d = M.deliveries;
  var o = '<section class="delivery-overview" aria-label="成片交付安排"><div class="delivery-heading"><h2>成片交付安排</h2><p>按已记录的交付日期排序</p></div>';
  if (!d.length) return o + '<p>暂无成片交付安排</p></section>';
  o += '<div class="delivery-scroll"><table><thead><tr><th>视频项目</th><th>初版目标（备注）</th><th>成片交付</th><th>当前进度</th></tr></thead><tbody>' + d.map(function(row){
    var fc = (row.nextStep || '').match(/(\d{1,2}月\d{1,2}日)出初版/);
    return '<tr><td><strong>' + esc(row.title) + '</strong>' + (d.filter(function(x){ return x.title === row.title; }).length > 1 ? '<small class="delivery-origin">' + Number(row.month.slice(0,4)) + '年' + Number(row.month.slice(5)) + '月档案</small>' : '') +
      '<details><summary>制作安排</summary><p>' + esc(row.nextStep || '') + '</p></details></td><td>' + (fc ? fc[1] : '备注未记录') + '</td><td><strong>' + (row.deadline ? '<time datetime="' + row.deadline + '">' + Number(row.deadline.slice(5,7)) + '月' + Number(row.deadline.slice(8)) + '日</time>' : '日期待定') + '</strong></td><td>' + esc(row.progress) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  return o;
}

function historyNewest(list){
  return (list || []).slice().sort(function(a, b){ return b.day.localeCompare(a.day) || b.id - a.id; });
}
function timelineHtml(list){
  if (!list.length) return '<p class="inline-empty">暂无进展记录</p>';
  return '<ol class="inline-timeline">' + list.map(function(e){
    return '<li><time datetime="' + esc(e.day) + '">' + esc(e.day) + (e.done ? ' · 已完成' : '') + '</time><p>' + esc(e.progress || '') + '</p></li>';
  }).join('') + '</ol>';
}
function dateCells(r){
  var doneDay = completionDay(r);
  var bits = [];
  var add = function(label, value){ if (!value) return; bits.push('<div><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>'); };
  add('计划日', r.planned);
  add('计划交付', r.deadline);
  add('原计划', r.originalPlan);
  add('完成日', r.done ? doneDay : '');
  return bits.length ? '<dl class="inline-dates">' + bits.join('') + '</dl>' : '';
}
function inlineDetailHtml(r, mode, day){
  var dayEvents = (day && (mode === 'today' || mode === 'yesterday')) ? historyNewest((r.history || []).filter(function(e){ return e.day === day; })) : [];
  var dayBlock = (mode === 'today' || mode === 'yesterday') ? '<section class="inline-block inline-day"><h4>当天进展</h4>' + (dayEvents.length ? timelineHtml(dayEvents) : '<p class="inline-empty">当天没有单独的进展记录</p>') + '</section>' : '';
  var progress = '<section class="inline-block inline-progress"><h4>当前进度</h4><p class="inline-text">' + esc(r.progress || (r.done ? '已完成' : '未填写进度')) + '</p></section>';
  var next = r.nextStep ? '<section class="inline-block inline-next"><h4>下一步</h4><p class="inline-text">' + esc(r.nextStep) + '</p></section>' : '';
  var req = r.requirements && String(r.requirements).trim() ? '<section class="inline-block inline-req"><h4>具体制作要求</h4><p class="inline-text">' + esc(r.requirements) + '</p></section>' : '';
  var histList = historyNewest(r.history);
  var hist = '<section class="inline-block inline-history"><h4>历史进展（' + histList.length + ' 条）</h4>' + timelineHtml(histList) + '</section>';
  var bottom = mode === 'week' ? '收起' : '收起详情';
  var cls = mode === 'week' ? 'inline-detail week-inline' : 'inline-detail';
  return '<div class="' + cls + '" hidden>' + dateCells(r) + dayBlock + progress + next + req + hist +
    '<div class="inline-actions"><button type="button" class="work-link detail-open" data-expand="1" aria-expanded="true">' + bottom + '</button></div></div>';
}
function rememberScroll(){
  return {
    x: window.scrollX, y: window.scrollY,
    nodes: Array.prototype.map.call(document.querySelectorAll('.planner-grid,.daily-list,.yesterday-list,.planner-week-list,.ledger-scroll'), function(el){ return { el: el, top: el.scrollTop }; })
  };
}
function restoreScroll(snap){
  if (!snap) return;
  window.scrollTo(snap.x, snap.y);
  snap.nodes.forEach(function(n){ if (n.el && n.el.isConnected) n.el.scrollTop = n.top; });
}
function applyExpand(root, open){
  root.classList.toggle('is-expanded', open);
  var panel = root.querySelector('.inline-detail');
  if (panel) panel.hidden = !open;
  root.querySelectorAll('.planner-preview').forEach(function(el){ el.hidden = open; });
  root.querySelectorAll('.inline-collapse-top').forEach(function(el){ el.hidden = !open; el.setAttribute('aria-expanded', 'true'); });
  root.querySelectorAll('.planner-foot .detail-open, .planner-card-actions .detail-open').forEach(function(el){
    el.textContent = open ? '收起详情' : '展开详情';
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var cue = root.querySelector('.week-detail-cue');
  if (cue) cue.textContent = open ? '收起' : '展开';
  var rowBtn = root.querySelector('.week-item-btn');
  if (rowBtn) rowBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function toggleExpand(root, source){
  if (!root) return;
  var snap = rememberScroll();
  var open = !root.classList.contains('is-expanded');
  applyExpand(root, open);
  restoreScroll(snap);
  if (!open && source){
    var hiddenNow = source.hidden || (source.closest && source.closest('[hidden]'));
    if (hiddenNow){
      var back = root.querySelector('.week-item-btn') || root.querySelector('.planner-card-actions .detail-open') || root.querySelector('.planner-foot .detail-open');
      if (back && back.focus) back.focus({ preventScroll: true });
    }
  }
  restoreScroll(snap);
}
/* WorkEditor（旧站组件；旧站页面未挂载，只在 ?edit=1 维护模式出现） */
var STAGE_OPTIONS = ['脚本已确认','收集素材中','剪辑中','字幕核对中','已导出待验收','已交付','已发布'];
var CATEGORY_OPTIONS = ['公益视频','字幕与翻译','活动与汇报','行政与采购','报销','视频制作','行政','采购','汇报','团队规划'];
function openEditor(id, week){
  var row = id ? M.rows.filter(function(r){ return r.id === id; })[0] : null;
  var latest = row && row.history[row.history.length - 1];
  var v = function(x){ return esc(x == null ? '' : x); };
  var dlg = $('workDialog');
  dlg.innerHTML = '<form id="workForm"><div class="work-heading"><h2>' + (row ? '工作详情' : '新增工作') + '</h2><button type="button" data-act="close-dialog" aria-label="关闭">✕</button></div>' +
    '<label>工作事项<input name="title" required maxlength="250" value="' + v(row && row.title) + '"></label><div class="work-fields">' +
    '<label>记录日期<input name="date" value="' + v(row ? row.date : TODAY) + '" placeholder="可留空"></label>' +
    '<label>所属项目<input name="project" list="work-projects" value="' + v(row && row.project) + '"><datalist id="work-projects">' + M.projects.map(function(p){ return '<option value="' + v(p) + '">'; }).join('') + '</datalist></label>' +
    '<label>类别<input name="category" list="work-categories" value="' + v(row && row.category) + '"></label>' +
    '<label>简短进度<input name="progress" list="work-stages" value="' + v(row && row.progress) + '"></label>' +
    '<label>计划日期<input type="date" name="planned" value="' + v(row && row.planned) + '"></label>' +
    '<label>实际完成日期<input type="date" name="completed" value="' + v(row && row.completed) + '"></label>' +
    '<label>反馈与验收<select name="review">' + ['', '待素材', '待反馈', '待验收'].map(function(o){ return '<option value="' + o + '"' + (((row && row.review) || '') === o ? ' selected' : '') + '>' + (o || '无') + '</option>'; }).join('') + '</select></label>' +
    '<label class="work-inline"><input type="checkbox" name="done"' + (row && row.done ? ' checked' : '') + '> 标记完成</label></div>' +
    (week ? '<label class="work-inline"><input type="checkbox" name="week"' + (!row || row.week === week ? ' checked' : '') + '> 加入所选周待安排</label>' : '') +
    (row && row.originalPlan ? '<p>原计划日期：' + row.originalPlan + '</p>' : '') +
    '<label>正在等什么<input name="waiting" value="' + v(latest && latest.waiting) + '"></label>' +
    '<label>下次跟进日期<input type="date" name="followUp" value="' + v(latest && latest.followUp) + '"></label>' +
    (row && row.history.length ? '<details><summary>进度历史</summary><ul>' + row.history.map(function(e){ return '<li>' + e.day + ' · ' + esc(e.progress || (e.done ? '已完成' : '—')) + '</li>'; }).join('') + '</ul></details>' : '') +
    '<label>具体制作要求<textarea name="requirements" maxlength="4000">' + v(row && row.requirements) + '</textarea></label>' +
    '<p class="planner-original">此栏在维护模式只保存在这台浏览器，不会写入共享工作库。系统录入以连接器为准。</p>' +
    '<label>下一步<textarea name="nextStep" maxlength="1000">' + v(row && row.nextStep) + '</textarea></label>' +
    '<p role="alert" id="workError"></p><button class="work-button">保存</button></form>';
  dlg.dataset.id = row ? row.id : ''; dlg.dataset.week = week || '';
  dlg.showModal();
}
function submitEditor(form){
  var dlg = $('workDialog'), id = dlg.dataset.id ? Number(dlg.dataset.id) : null, week = dlg.dataset.week || null;
  var row = id ? M.rows.filter(function(r){ return r.id === id; })[0] : null;
  var fields = {}; new FormData(form).forEach(function(val, k){ fields[k] = val; });
  try {
    apiWork(Object.assign({}, fields, { id: id == null ? undefined : id, done: fields.done === 'on', week: week ? (fields.week === 'on' ? week : (row && row.week === week ? null : (row ? row.week : null))) : (row ? row.week : null) }));
    dlg.close(); render();
  } catch (e) { $('workError').textContent = e.message || '保存失败'; }
}

/* 导出 / 导入备份（离线版代替服务器数据库所必需） */
function exportBackup(){
  var db = currentDb();
  var blob = new Blob([JSON.stringify({ app: 'LanGui 专业工作库', format: 'langui-backup-v3', exportedAt: new Date().toISOString(), base: BASE.version, saved: saved, database: db }, null, 1)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'LanGui工作库备份_' + TODAY + '.json'; document.body.appendChild(a); a.click(); a.remove();
}
function importBackup(file){
  var r = new FileReader();
  r.onload = function(){ try { var j = JSON.parse(r.result); if (!j || j.format !== 'langui-backup-v3' || !j.saved || j.saved.v !== 3) throw Error('不是本工作库的备份文件');
    saved = j.saved; persist(); render(); alert('已导入备份'); } catch (e) { alert('导入失败：' + e.message); } };
  r.readAsText(file);
}

/* ── 事件 ── */
document.addEventListener('click', function(e){
  var a = e.target.closest('a[data-nav]');
  if (a){
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var nav = a.dataset.nav;
    if (nav === 'year') push(yearTargetHref(a.dataset.month));
    else if (nav === 'month') push(ledgerChangeUrl(a.dataset.month, {}));
    else { var href = a.getAttribute('href'); push(href); var hash = location.hash.slice(1); if (hash){ var el = document.getElementById(hash); if (el) el.scrollIntoView({ block: 'start' }); } }
    return;
  }
  var b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.view){
    var view = b.dataset.view, url = new URL(location.href);
    if (view === 'week' && url.searchParams.has('month')) url.searchParams.set('view', 'home');
    url.hash = view === 'social' ? 'social-media' : view === 'delivery' ? 'delivery' : view === 'weekly-record' ? 'weekly-record' : view === 'weekly-work-report' ? 'weekly-work-report' : view === 'weekly-report' ? 'weekly-report' : '';
    if (view === 'weekly-work-report') {
      var chosen = url.searchParams.get('week');
      if (!chosen) url.searchParams.set('week', monday(todayShanghai()));
      else if (validDate(chosen)) url.searchParams.set('week', monday(chosen));
    }
    push(url); return;
  }
  if (b.id === 'refreshButton'){ location.reload(); return; }
  var act = b.dataset.act;
  if (act === 'copy-record' || act === 'copy-speech'){
    ui.error = ''; var text = act === 'copy-record' ? ui.copyText : ui.speech;
    copy(text).then(function(){ if (act === 'copy-record') ui.copied = true; else ui.speechCopied = true; render(); setTimeout(function(){ ui.copied = false; ui.speechCopied = false; render(); }, 2500); },
      function(){ ui.error = '复制失败，可选择文字手动复制'; render(); });
    return;
  }
  if (act === 'close-dialog'){ $('workDialog').close(); return; }
  if (act === 'export'){ exportBackup(); return; }
  if (act === 'import'){ $('importFile').click(); return; }
  if (b.hasAttribute('data-expand')){ toggleExpand(b.closest('[data-expand-key]'), b); return; }
  if (b.dataset.edit){ openEditor(Number(b.dataset.edit), b.dataset.week || null); return; }
  if (b.dataset.new){ openEditor(null, b.dataset.week || null); return; }
});
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  var cur = document.activeElement;
  var root = cur && cur.closest ? cur.closest('[data-expand-key].is-expanded') : null;
  if (!root) return;
  var snap = rememberScroll();
  applyExpand(root, false);
  var back = root.querySelector('.week-item-btn') || root.querySelector('.planner-card-actions .detail-open') || root.querySelector('.planner-foot .detail-open');
  if (back && back.focus) back.focus({ preventScroll: true });
  restoreScroll(snap);
});
function copy(text){
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
  return fallback();
  function fallback(){ return new Promise(function(res, rej){ var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (x) {} t.remove(); ok ? res() : rej(); }); }
}
document.addEventListener('change', function(e){
  if (e.target.id === 'weekMonthSelect'){
    var month = e.target.value;
    var url = new URL(location.href); url.searchParams.set('month', month); url.searchParams.set('week', weekForMonth(month, M.today)); url.searchParams.set('view', 'home'); url.hash = '';
    push(url);
  } else if (e.target.id === 'socialMonthSelect'){
    ui.socialMonth = e.target.value; var u = new URL(location.href); u.searchParams.set('socialMonth', e.target.value); try { history.replaceState(null, '', u); } catch (x) {} render();
  } else if (e.target.id === 'importFile' && e.target.files[0]){ importBackup(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('submit', function(e){
  if (e.target.id === 'ledgerFilter'){
    e.preventDefault();
    var f = {}; new FormData(e.target).forEach(function(v, k){ if (v) f[k] = v; });
    push(ledgerChangeUrl(ledgerSelection().month, f));
  } else if (e.target.id === 'workForm'){ e.preventDefault(); submitEditor(e.target); }
});
window.addEventListener('popstate', render);
window.addEventListener('hashchange', render);
/* 旧站 LiveSync：别的窗口改了数据，这里自动更新（编辑中不打扰） */
window.addEventListener('storage', function(e){
  if (e.key !== KEY) return;
  saved = loadSaved();
  var f = document.activeElement;
  if ((f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) || document.querySelector('dialog[open]')) return;
  render();
});
/* 首次打开：回到页面顶部，去掉 #week（与旧站相同） */
(function(){
  if (location.hash === '#week'){ var u = new URL(location.href); u.hash = ''; try { history.replaceState(history.state, '', u); } catch (x) {} }
  render();
  if (!location.hash) window.scrollTo(0, 0);
})();
window.__LG = { apiWork: apiWork, currentDb: currentDb, model: function(){ return model(); } };
})();

