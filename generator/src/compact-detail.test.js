// 合成数据：默认只显示重点，点击后在卡片内原地展开。不读取真实工作库。
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const assert = require('assert');

const puppeteerPath = process.env.PUPPETEER_CORE
  || (() => { try { return require.resolve('puppeteer-core'); } catch (e) { return '/workspace/langui/test/node_modules/puppeteer-core'; } })();
const puppeteer = require(puppeteerPath);
const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
assert(chrome, '找不到 Chrome');

const fill = (ch, n) => ch.repeat(n);
const LONG = 'P1027342.MOV/' + 'abcdefghij'.repeat(16);
const PROGRESS = fill('进', 40) + '\n' + fill('进', 50) + 'PROGRESS_TAIL ' + LONG;
const NEXT = fill('下', 90) + 'NEXT_TAIL';
const REQ = '要求甲\n要求乙 <b>不是标签</b> 以及 </script>' + fill('求', 40) + 'REQ_TAIL';
const EVENT_NEW = fill('新', 80) + 'EVENT_NEW_TAIL';
const EVENT_OLD = fill('旧', 40) + 'EVENT_OLD_TAIL';
const EVENT_OLDER = fill('更', 24) + 'EVENT_OLDER_TAIL';
const NOTE = fill('注', 90) + 'NOTE_NOT_YDAY';
const Y_NEW = fill('昨', 80) + 'YDAY_NEW_TAIL';
const Y_OLD = fill('史', 40) + 'YDAY_OLD_TAIL';
const Y_OLDER = fill('早', 24) + 'YDAY_OLDER_TAIL';

const srcDir = __dirname;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-compact-'));
fs.mkdirSync(path.join(root, 'restore', 'src'), {recursive: true});
fs.mkdirSync(path.join(root, 'build'), {recursive: true});
for (const name of ['app.js', 'app.html', 'build.py']) fs.copyFileSync(path.join(srcDir, name), path.join(root, 'restore', 'src', name));
const task = (extra) => Object.assign({
  hidden: false, week: null, originalPlan: null, deadline: null, next: null, monthNotes: [], stages: null, shoot: null,
  initial: null, history: [], urgent: false, src: 'synthetic', handover: null, requirements: null, done: false, completed: null
}, extra);
const data = {
  version: 'synthetic',
  tasks: [
    task({id: 101, title: '合成重点甲', month: '2026-11', dateText: '11月18日', note: PROGRESS, plan: '2026-11-18', next: NEXT, requirements: REQ, recordDay: '2026-11-18', sortDay: '2026-11-18', events: [
      {seq: 8, day: '2026-11-01', text: EVENT_OLDER, done: false},
      {seq: 9, day: '2026-11-18', text: EVENT_OLD, done: false},
      {seq: 10, day: '2026-11-18', text: EVENT_NEW, done: false}
    ]}),
    task({id: 102, title: '合成重点乙', month: '2026-11', dateText: '11月18日', note: fill('乙', 120) + 'TAIL_B', plan: '2026-11-18', next: fill('步', 80), requirements: fill('求', 60), recordDay: '2026-11-18', sortDay: '2026-11-18', events: [{seq: 20, day: '2026-11-18', text: fill('事', 70), done: false}]}),
    task({id: 103, title: '合成重点丙', month: '2026-11', dateText: '11月18日', note: fill('丙', 120) + 'TAIL_C', plan: '2026-11-18', recordDay: '2026-11-18', sortDay: '2026-11-18', events: []}),
    task({id: 104, title: '合成重点丁', month: '2026-11', dateText: '11月18日', note: fill('丁', 120) + 'TAIL_D', plan: '2026-11-18', recordDay: '2026-11-18', sortDay: '2026-11-18', events: []}),
    task({id: 106, title: '合成重点戊', month: '2026-11', dateText: '11月18日', note: '戊的短进度', plan: '2026-11-18', recordDay: '2026-11-18', sortDay: '2026-11-18', events: []}),
    task({id: 107, title: '合成重点己', month: '2026-11', dateText: '11月19日', note: '己的短进度', plan: '2026-11-19', recordDay: '2026-11-19', sortDay: '2026-11-19', events: []}),
    task({id: 105, title: '合成昨天重点', month: '2026-11', dateText: '11月16日', note: NOTE, plan: '2026-11-16', originalPlan: '2026-11-02', deadline: '2026-11-30', next: NEXT, requirements: REQ, recordDay: '2026-11-16', sortDay: '2026-11-16', events: [
      {seq: 1, day: '2026-11-10', text: Y_OLDER, done: false},
      {seq: 2, day: '2026-11-17', text: Y_OLD, done: false},
      {seq: 3, day: '2026-11-17', text: Y_NEW, done: false}
    ]}),
    task({id: 108, title: '合成昨天乙', month: '2026-11', dateText: '11月17日', note: '昨天乙进度', plan: '2026-11-17', recordDay: '2026-11-17', sortDay: '2026-11-17', events: [{seq: 30, day: '2026-11-17', text: '昨天乙记录', done: false}]}),
    task({id: 109, title: '合成昨天丙', month: '2026-11', dateText: '11月17日', note: '昨天丙进度', plan: '2026-11-17', recordDay: '2026-11-17', sortDay: '2026-11-17', events: [{seq: 31, day: '2026-11-17', text: '昨天丙记录', done: false}]})
  ],
  social: [],
  platforms: []
};
const dataPath = path.join(root, 'build', 'data.json');
fs.writeFileSync(dataPath, JSON.stringify(data));
const out = path.join(root, 'restore', 'out.html');
const built = spawnSync('python3', [path.join(srcDir, 'build.py')], {env: Object.assign({}, process.env, {
  LANGUI_ROOT: root, LANGUI_DATA: dataPath, LANGUI_HTML: out,
  LANGUI_PORTRAIT_URI: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
})});
if (built.status !== 0) { console.error(built.stdout.toString(), built.stderr.toString()); process.exit(1); }
const html = fs.readFileSync(out, 'utf8');
assert.equal((html.match(/<script>/g) || []).length, 2, '要求里的 script 结束标记不得截断页面脚本');
assert(!html.includes('id="detailDialog"'), '只读详情弹窗应已移除');
assert(html.includes('id="workDialog"'));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-compact-chrome-'));
  const browser = await puppeteer.launch({executablePath: chrome, headless: 'new', userDataDir: dir, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const open = async (q) => {
    await page.goto('file://' + out + q, {waitUntil: 'load'});
    await page.waitForFunction('window.__LG_READY');
  };
  const readExpanded = (kind, title) => page.evaluate((k, t) => {
    const root = k === 'card'
      ? [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4') && el.querySelector('h4').textContent === t)
      : [...document.querySelectorAll(k + ' > li')].find((el) => el.querySelector(':scope > .day-item-top strong') && el.querySelector(':scope > .day-item-top strong').textContent === t);
    const panel = root.querySelector('.inline-detail');
    const section = (name) => {
      const h = [...panel.querySelectorAll('h4')].find((x) => x.textContent.trim() === name || x.textContent.trim().startsWith(name));
      if (!h) return { text: '', body: '', html: '' };
      const p = h.parentElement.querySelector('p.inline-text, p.inline-empty');
      return { text: h.parentElement.innerText, body: p ? p.textContent : h.parentElement.innerText, html: p ? p.innerHTML : '' };
    };
    const items = (sel) => [...panel.querySelectorAll(sel + ' li')].map((li) => ({
      day: li.querySelector('time') ? li.querySelector('time').getAttribute('datetime') : '',
      text: li.innerText
    }));
    const wide = [root, panel, ...panel.querySelectorAll('*')].filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).slice(0, 6).map((el) => ({
      tag: el.tagName, cls: String(el.className).slice(0, 80), sw: el.scrollWidth, cw: el.clientWidth
    }));
    const mainBtn = root.querySelector('.planner-card-actions .detail-open, .planner-foot .detail-open');
    return {
      expanded: root.classList.contains('is-expanded'),
      hidden: panel.hidden,
      height: root.offsetHeight,
      title: (root.querySelector(':scope > h4') || root.querySelector(':scope > .day-item-top strong')).textContent,
      headings: [...panel.querySelectorAll('h4')].map((h) => h.textContent.trim()),
      progress: section('当前进度'),
      next: section('下一步'),
      req: section('具体制作要求'),
      day: section('当天进展'),
      historyHeading: (panel.querySelector('.inline-history h4') || {}).textContent || '',
      history: items('.inline-history'),
      dayItems: items('.inline-day'),
      dates: panel.querySelector('.inline-dates') ? panel.querySelector('.inline-dates').innerText : '',
      previewHidden: root.querySelector('.planner-preview') ? root.querySelector('.planner-preview').hidden : true,
      button: mainBtn ? mainBtn.textContent : '',
      expandedAttr: mainBtn ? mainBtn.getAttribute('aria-expanded') : '',
      top: root.querySelector('.inline-collapse-top') ? { hidden: root.querySelector('.inline-collapse-top').hidden, text: root.querySelector('.inline-collapse-top').textContent } : null,
      bottom: (root.querySelector('.inline-actions .detail-open') || {}).textContent || '',
      nested: panel.querySelectorAll('details').length,
      dialogs: document.querySelectorAll('dialog[open]').length,
      wide
    };
  }, kind, title);
  const scrolls = () => page.evaluate(() => ({
    g: document.querySelector('.planner-grid').scrollTop,
    d: document.querySelector('.daily-list').scrollTop,
    y: document.querySelector('.yesterday-list').scrollTop,
    w: document.querySelector('.planner-week-list').scrollTop,
    yx: window.scrollY
  }));

  await page.setViewport({width: 1440, height: 900});
  await open('?today=2026-11-18&view=home');
  const desk = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.planner-week-overview > section')];
    const col = document.querySelector('.planner-week-schedule');
    const grid = col.querySelector('.planner-grid');
    const today = document.querySelector('.planner-today .daily-list');
    const box = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll('.planner-card')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        h: el.offsetHeight,
        title: el.querySelector('h4').textContent,
        full: r.top >= box.top - 1 && r.bottom <= box.bottom + 1,
        seen: r.top < box.bottom - 8 && r.bottom > box.top + 8
      };
    });
    const tbox = today.getBoundingClientRect();
    const todays = [...today.querySelectorAll('li')].map((el) => {
      const r = el.getBoundingClientRect();
      return {h: el.offsetHeight, full: r.top >= tbox.top - 1 && r.bottom <= tbox.bottom + 1, seen: r.top < tbox.bottom - 8};
    });
    const tops = cols.map((el) => Math.round(el.getBoundingClientRect().top));
    const heights = cols.map((el) => el.offsetHeight);
    const yItem = [...document.querySelectorAll('.yesterday-list li')].find((li) => li.textContent.includes('合成昨天重点'));
    const card = [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成昨天重点');
    const todayItem = [...document.querySelectorAll('.daily-list li')].find((li) => li.textContent.includes('合成重点甲'));
    const btn = card.querySelector('.planner-card-actions .detail-open');
    const weekCue = [...document.querySelectorAll('.week-item-btn')].find((b) => b.textContent.includes('合成昨天重点'));
    return {
      heights, tops, cards, todays,
      yH: yItem.offsetHeight,
      yText: yItem.innerText,
      cardText: card.innerText,
      todayText: todayItem.innerText,
      todayBtn: todayItem.querySelector('.planner-foot .detail-open').textContent,
      todayAria: todayItem.querySelector('.planner-foot .detail-open').getAttribute('aria-expanded'),
      btn: {type: btn.getAttribute('type'), text: btn.textContent, aria: btn.getAttribute('aria-expanded')},
      weekCue: weekCue.querySelector('.week-detail-cue').textContent,
      weekAria: weekCue.getAttribute('aria-expanded'),
      dialogs: document.querySelectorAll('dialog').length,
      openDialogs: document.querySelectorAll('dialog[open]').length,
      banned: document.querySelector('.planner-week-overview').innerText.includes('初稿已完成')
    };
  });
  assert.deepEqual(desk.heights, [440, 440, 440, 440]);
  assert.equal(desk.tops.length, 4);
  assert(Math.max(...desk.tops) - Math.min(...desk.tops) < 2, '桌面四栏应并排');
  assert(desk.cards.length >= 4);
  assert(desk.cards.every((c) => c.h <= 230), '卡片过高 ' + JSON.stringify(desk.cards));
  assert(desk.cards.filter((c) => c.seen).length >= 3, '同屏可见卡片不足 ' + JSON.stringify(desk.cards));
  assert(desk.todays.filter((c) => c.seen).length >= 2, '今天栏同屏不足 ' + JSON.stringify(desk.todays));
  assert(desk.yH <= 230);
  assert.equal(desk.btn.type, 'button');
  assert.equal(desk.btn.text, '展开详情');
  assert.equal(desk.btn.aria, 'false');
  assert.equal(desk.todayBtn, '展开详情');
  assert.equal(desk.todayAria, 'false');
  assert.equal(desk.weekCue, '展开');
  assert.equal(desk.weekAria, 'false');
  assert.equal(desk.dialogs, 1);
  assert.equal(desk.openDialogs, 0);
  assert.equal(desk.banned, false);
  assert(desk.cardText.includes('原计划：2026-11-02'));
  assert(desk.cardText.includes('计划交付：2026-11-30'));
  assert(desk.cardText.includes('含制作要求'));
  assert(/历史 \d+ 条/.test(desk.cardText));
  assert(!desk.cardText.includes('NOTE_NOT_YDAY'));
  assert(!desk.cardText.includes('REQ_TAIL'));
  assert(!desk.cardText.includes('YDAY_NEW_TAIL'));
  assert(!desk.todayText.includes('PROGRESS_TAIL'));
  assert(!desk.todayText.includes('P1027342.MOV'));
  assert(!desk.todayText.includes('NEXT_TAIL'));
  assert(!desk.todayText.includes('REQ_TAIL'));
  assert(!desk.todayText.includes('EVENT_NEW_TAIL'));
  assert(desk.todayText.includes('当前进度'));
  assert(desk.todayText.includes('今日安排'));
  assert(desk.todayText.includes('展开详情'));
  assert(desk.yText.includes('最新进展'));
  assert(!desk.yText.includes('NOTE_NOT_YDAY'));
  assert(!desk.yText.includes('YDAY_NEW_TAIL'));
  assert(!desk.yText.includes('YDAY_OLD_TAIL'));
  assert(!desk.yText.includes('YDAY_OLDER_TAIL'));
  console.log('✓ 桌面默认态紧凑：四栏 440，多条同屏，按钮为展开详情', desk.cards.map((c) => c.h).join(','));

  const beforeH = await page.evaluate(() => [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲')).offsetHeight);
  await page.evaluate(() => {
    document.querySelector('.planner-grid').scrollTop = 80;
    document.querySelector('.daily-list').scrollTop = 40;
    document.querySelector('.yesterday-list').scrollTop = 30;
    document.querySelector('.planner-week-list').scrollTop = 24;
    window.scrollTo(0, 180);
  });
  const beforeScroll = await scrolls();
  assert(beforeScroll.g >= 40 && beforeScroll.d >= 20 && beforeScroll.yx >= 100, JSON.stringify(beforeScroll));
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲'));
    li.querySelector('.planner-foot .detail-open').click();
  });
  let detail = await readExpanded('.daily-list', '合成重点甲');
  assert.equal(detail.dialogs, 0);
  assert.equal(detail.expanded, true);
  assert.equal(detail.hidden, false);
  assert(detail.height > beforeH + 80, '展开后应明显拉长 ' + beforeH + ' -> ' + detail.height);
  assert.equal(detail.button, '收起详情');
  assert.equal(detail.expandedAttr, 'true');
  assert.equal(detail.previewHidden, true);
  assert.equal(detail.top.hidden, false);
  assert.equal(detail.top.text, '收起');
  assert.equal(detail.bottom, '收起详情');
  assert.equal(detail.nested, 0);
  assert.deepEqual(detail.headings, ['当天进展', '当前进度', '下一步', '具体制作要求', '历史进展（3 条）']);
  assert(detail.progress.body.includes('PROGRESS_TAIL') && detail.progress.body.includes('\n') && detail.progress.body.includes('P1027342.MOV'));
  assert(detail.next.body.includes('NEXT_TAIL'));
  assert(detail.req.body.includes('REQ_TAIL'));
  assert(detail.req.body.includes('要求甲\n要求乙'));
  assert(detail.req.body.includes('</script>'));
  assert(detail.req.body.includes('<b>不是标签</b>'));
  assert(!detail.req.html.includes('<b>'));
  assert(!detail.req.html.includes('</script>'));
  assert(detail.req.html.includes('&lt;/script&gt;'));
  assert(!detail.progress.body.includes('REQ_TAIL'));
  assert(!detail.req.body.includes('PROGRESS_TAIL'));
  assert(!detail.next.body.includes('PROGRESS_TAIL'));
  assert.deepEqual(detail.dayItems.map((it) => it.day), ['2026-11-18', '2026-11-18']);
  assert(detail.dayItems[0].text.includes('EVENT_NEW_TAIL') && detail.dayItems[1].text.includes('EVENT_OLD_TAIL'));
  assert(!detail.day.text.includes('EVENT_OLDER_TAIL'));
  assert.deepEqual(detail.history.map((it) => it.day), ['2026-11-18', '2026-11-18', '2026-11-01']);
  assert(detail.history[0].text.includes('EVENT_NEW_TAIL'));
  assert(detail.history[2].text.includes('EVENT_OLDER_TAIL'));
  assert(detail.dates.includes('计划日') && detail.dates.includes('2026-11-18'));
  assert.equal(detail.wide.length, 0, JSON.stringify(detail.wide));
  assert.equal(await page.$$eval('script', (els) => els.length), 2);
  const midScroll = await scrolls();
  assert.deepEqual(midScroll, beforeScroll);

  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成重点乙');
    card.querySelector('.planner-card-actions .detail-open').click();
  });
  const both = await page.evaluate(() => ({
    today: [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲')).classList.contains('is-expanded'),
    card: [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成重点乙').classList.contains('is-expanded'),
    dialogs: document.querySelectorAll('dialog[open]').length
  }));
  assert.equal(both.today, true);
  assert.equal(both.card, true);
  assert.equal(both.dialogs, 0);
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲'));
    li.querySelector('.inline-actions .detail-open').click();
  });
  const afterOne = await page.evaluate(() => ({
    today: [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲')).classList.contains('is-expanded'),
    todayH: [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲')).offsetHeight,
    card: [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成重点乙').classList.contains('is-expanded'),
    btn: [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲')).querySelector('.planner-foot .detail-open').textContent
  }));
  assert.equal(afterOne.today, false);
  assert(afterOne.todayH <= beforeH + 2, '收起后应回到紧凑高度 ' + afterOne.todayH + ' vs ' + beforeH);
  assert.equal(afterOne.card, true);
  assert.equal(afterOne.btn, '展开详情');
  await page.evaluate(() => {
    [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成重点乙').querySelector('.inline-collapse-top').click();
  });
  assert.equal(await page.evaluate(() => document.querySelectorAll('.is-expanded').length), 0);
  const afterScroll = await scrolls();
  assert.deepEqual(afterScroll, beforeScroll);
  console.log('✓ 原地展开全文且无弹窗，收起后高度与各栏滚动位置保持，多卡独立');

  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.yesterday-list > li')].find((el) => el.querySelector('strong') && el.querySelector('strong').textContent === '合成昨天重点');
    li.querySelector('.planner-foot .detail-open').click();
  });
  detail = await readExpanded('.yesterday-list', '合成昨天重点');
  assert.equal(detail.dialogs, 0);
  assert.equal(detail.title, '合成昨天重点');
  assert(detail.dayItems[0].text.includes('YDAY_NEW_TAIL') && detail.dayItems[1].text.includes('YDAY_OLD_TAIL'));
  assert(!detail.day.text.includes('NOTE_NOT_YDAY'));
  assert(!detail.day.text.includes('YDAY_OLDER_TAIL'));
  assert(detail.progress.body.includes('NOTE_NOT_YDAY'));
  assert.deepEqual(detail.history.map((it) => it.day), ['2026-11-17', '2026-11-17', '2026-11-10']);
  assert(detail.history[2].text.includes('YDAY_OLDER_TAIL'));
  assert(detail.dates.includes('原计划') && detail.dates.includes('2026-11-02'));
  assert(detail.dates.includes('计划交付') && detail.dates.includes('2026-11-30'));
  assert(detail.dates.includes('计划日') && detail.dates.includes('2026-11-16'));
  assert(!detail.req.body.includes('NOTE_NOT_YDAY'));
  assert.equal(detail.wide.length, 0, JSON.stringify(detail.wide));
  await page.evaluate(() => document.querySelector('.yesterday-list .is-expanded .inline-collapse-top').click());
  await page.evaluate(() => [...document.querySelectorAll('.week-item-btn')].find((b) => b.textContent.includes('合成昨天重点')).click());
  const week = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.planner-week-list li')].find((el) => el.textContent.includes('合成昨天重点'));
    const panel = li.querySelector('.inline-detail');
    const text = (name) => {
      const h = [...panel.querySelectorAll('h4')].find((x) => x.textContent.trim() === name || x.textContent.startsWith(name));
      return h ? h.parentElement.innerText : '';
    };
    return {
      expanded: li.classList.contains('is-expanded'),
      cue: li.querySelector('.week-detail-cue').textContent,
      aria: li.querySelector('.week-item-btn').getAttribute('aria-expanded'),
      headings: [...panel.querySelectorAll('h4')].map((h) => h.textContent.trim()),
      progress: text('当前进度'),
      req: text('具体制作要求'),
      next: text('下一步'),
      dialogs: document.querySelectorAll('dialog[open]').length,
      below: panel.getBoundingClientRect().top >= li.querySelector('.week-item-btn').getBoundingClientRect().top
    };
  });
  assert.equal(week.expanded, true);
  assert.equal(week.cue, '收起');
  assert.equal(week.aria, 'true');
  assert.equal(week.dialogs, 0);
  assert.equal(week.below, true);
  assert(!week.headings.includes('当天进展'));
  assert(week.headings.some((h) => h.startsWith('历史进展（')));
  assert(week.progress.includes('NOTE_NOT_YDAY'));
  assert(week.req.includes('REQ_TAIL'));
  assert(week.next.includes('NEXT_TAIL'));
  await page.evaluate(() => [...document.querySelectorAll('.week-item-btn')].find((b) => b.textContent.includes('合成昨天重点')).click());
  const weekClosed = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.planner-week-list li')].find((el) => el.querySelector('strong') && el.querySelector('strong').textContent === '合成昨天重点');
    return { expanded: li.classList.contains('is-expanded'), cue: li.querySelector('.week-detail-cue').textContent, hidden: li.querySelector('.inline-detail').hidden, text: li.innerText.includes('NOTE_NOT_YDAY') };
  });
  assert.equal(weekClosed.expanded, false);
  assert.equal(weekClosed.cue, '展开');
  assert.equal(weekClosed.hidden, true);
  assert.equal(weekClosed.text, false);
  console.log('✓ 昨天区分当天进展与当前进度；本周工作内容在行下原地展开并可收起');

  await page.focus('.planner-card .planner-card-actions .detail-open');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.planner-card.is-expanded'));
  assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.is-expanded'));
  assert((await page.evaluate(() => document.activeElement.className)).includes('detail-open'));
  console.log('✓ 回车展开，ESC 收起且不出现弹窗');

  await open('?today=2026-11-18&edit=1&view=home');
  await page.evaluate(() => document.querySelector('.planner-card-actions .detail-open').click());
  assert.equal(await page.evaluate(() => document.querySelector('.planner-card.is-expanded') && document.querySelectorAll('dialog[open]').length), 0);
  await page.evaluate(() => document.querySelector('[data-edit="101"]').click());
  await page.waitForSelector('#workForm textarea[name=requirements]');
  assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 1);
  assert.equal(await page.$eval('#workDialog', (el) => el.open), true);
  assert((await page.$eval('#workForm textarea[name=requirements]', (el) => el.value)).includes('REQ_TAIL'));
  await page.click('#workDialog [data-act=close-dialog]');
  await page.waitForFunction(() => !document.querySelector('#workDialog[open]'));
  console.log('✓ 展开详情不打开编辑弹窗，?edit=1 的维护弹窗仍可用');

  await page.setViewport({width: 390, height: 844});
  await open('?today=2026-11-18&view=home');
  const mobile = await page.evaluate(() => {
    const overview = document.querySelector('.planner-week-overview');
    const card = document.querySelector('.planner-card');
    const tops = [...overview.children].map((el) => Math.round(el.getBoundingClientRect().top));
    return {
      overflow: overview.scrollWidth - overview.clientWidth,
      cardW: card.getBoundingClientRect().width,
      viewW: window.innerWidth,
      stacked: Math.max(...tops) - Math.min(...tops) > 40,
      btn: card.querySelector('.planner-card-actions .detail-open').textContent
    };
  });
  assert(mobile.stacked, '窄屏应改为上下排列');
  assert(mobile.overflow <= 1);
  assert(mobile.cardW <= mobile.viewW);
  assert.equal(mobile.btn, '展开详情');
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.daily-list > li')].find((el) => el.querySelector('strong') && el.querySelector('strong').textContent === '合成重点甲');
    li.querySelector('.planner-foot .detail-open').click();
  });
  const mobileBody = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.daily-list > li')].find((el) => el.classList.contains('is-expanded'));
    const body = li.querySelector('.inline-detail');
    const wide = [li, body, ...body.querySelectorAll('*')].filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).slice(0, 8).map((el) => ({
      tag: el.tagName, cls: String(el.className).slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth
    }));
    return {
      dialogs: document.querySelectorAll('dialog[open]').length,
      sw: body.scrollWidth, cw: body.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text: body.innerText.includes('P1027342.MOV') && body.innerText.includes('PROGRESS_TAIL'),
      wide
    };
  });
  assert.equal(mobileBody.dialogs, 0);
  assert(mobileBody.text && mobileBody.sw <= mobileBody.cw + 1 && mobileBody.page <= 1, JSON.stringify(mobileBody));
  console.log('✓ 窄屏栏位上下排列，展开后长文件名换行且无横向溢出');

  assert.equal(errors.length, 0, errors.join('\n'));
  await browser.close();
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(root, {recursive: true, force: true});
  console.log('COMPACT_PASS');
})().catch((err) => { console.error('FAIL', err); process.exit(1); });
