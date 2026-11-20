// 合成数据：长记录默认只显示重点，点击「查看详情」再看全文。不读取真实工作库。
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const assert = require('assert');

const puppeteerPath = process.env.PUPPETEER_CORE
  || (() => { try { return require.resolve('puppeteer-core'); } catch (e) { return '/workspace/langui/test/node_modules/puppeteer-core'; } })();
const puppeteer = require(puppeteerPath);
const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
assert(chrome, '找不到 Chrome');

const fill = (ch, n) => ch.repeat(n);
const PROGRESS = fill('进', 90) + 'PROGRESS_TAIL';
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
    task({id: 105, title: '合成昨天重点', month: '2026-11', dateText: '11月16日', note: NOTE, plan: '2026-11-16', originalPlan: '2026-11-02', deadline: '2026-11-30', next: NEXT, requirements: REQ, recordDay: '2026-11-16', sortDay: '2026-11-16', events: [
      {seq: 1, day: '2026-11-10', text: Y_OLDER, done: false},
      {seq: 2, day: '2026-11-17', text: Y_OLD, done: false},
      {seq: 3, day: '2026-11-17', text: Y_NEW, done: false}
    ]})
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
assert(!html.includes(PROGRESS) || html.includes('\\/script') || html.includes('<\\/'), '长文本可以进数据，但不得以未转义的脚本结束标记截断页面');

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
  const readDetail = () => page.evaluate(() => {
    const dlg = document.getElementById('detailDialog');
    const section = (name) => {
      const h = [...dlg.querySelectorAll('h4')].find((x) => x.textContent.trim() === name);
      if (!h) return { text: '', html: '' };
      const p = h.parentElement.querySelector('p.detail-text, p.detail-empty');
      return { text: h.parentElement.innerText, body: p ? p.textContent : '', html: p ? p.innerHTML : '' };
    };
    const items = (sel) => [...dlg.querySelectorAll(sel + ' li')].map((li) => ({
      day: li.querySelector('time') ? li.querySelector('time').getAttribute('datetime') : '',
      text: li.innerText
    }));
    return {
      title: dlg.querySelector('.detail-task-title').textContent,
      headings: [...dlg.querySelectorAll('h4')].map((h) => h.textContent.trim()),
      progress: section('当前进度'),
      next: section('下一步'),
      req: section('具体制作要求'),
      day: section('当天进展'),
      history: items('.detail-history'),
      dayItems: items('.detail-day'),
      dates: dlg.querySelector('.detail-dates').innerText,
      workOpen: document.getElementById('workDialog').open
    };
  });
  const closeDetail = async () => {
    await page.click('#detailDialog [data-detail-close]');
    await page.waitForFunction(() => !document.querySelector('#detailDialog[open]'));
  };

  await page.setViewport({width: 1440, height: 900});
  await open('?today=2026-11-18&view=home');
  const desk = await page.evaluate(() => {
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
    const tops = [...document.querySelectorAll('.planner-week-overview > section')].map((el) => Math.round(el.getBoundingClientRect().top));
    const yItem = [...document.querySelectorAll('.yesterday-list li')].find((li) => li.textContent.includes('合成昨天重点'));
    const card = [...document.querySelectorAll('.planner-card')].find((el) => el.querySelector('h4').textContent === '合成昨天重点');
    const todayItem = [...document.querySelectorAll('.daily-list li')].find((li) => li.textContent.includes('合成重点甲'));
    const btn = card.querySelector('.detail-open');
    return {
      colH: col.offsetHeight,
      gridH: grid.clientHeight,
      cards, todays, tops,
      yH: yItem.offsetHeight,
      yText: yItem.innerText,
      cardText: card.innerText,
      todayText: todayItem.innerText,
      btn: {type: btn.getAttribute('type'), text: btn.textContent}
    };
  });
  assert.equal(desk.colH, 440);
  assert.equal(desk.tops.length, 4);
  assert(Math.max(...desk.tops) - Math.min(...desk.tops) < 2, '桌面四栏应并排');
  assert(desk.cards.length >= 4);
  assert(desk.cards.every((c) => c.h <= 210), '卡片过高 ' + JSON.stringify(desk.cards));
  assert(desk.cards.every((c) => c.h < desk.gridH * 0.62), '单卡仍占满栏 ' + JSON.stringify(desk.cards));
  assert(desk.cards.filter((c) => c.full).length >= 2, '同屏完整卡片不足 ' + JSON.stringify(desk.cards));
  assert(desk.cards.filter((c) => c.seen).length >= 3, '同屏可见卡片不足 ' + JSON.stringify(desk.cards));
  assert(desk.todays.filter((c) => c.seen).length >= 2, '今天栏同屏不足 ' + JSON.stringify(desk.todays));
  assert(desk.yH <= 210);
  assert.equal(desk.btn.type, 'button');
  assert.equal(desk.btn.text, '查看详情');
  assert(desk.cardText.includes('原计划：2026-11-02'));
  assert(desk.cardText.includes('计划交付：2026-11-30'));
  assert(desk.cardText.includes('含制作要求'));
  assert(/历史 \d+ 条/.test(desk.cardText));
  assert(!desk.cardText.includes('NOTE_NOT_YDAY'));
  assert(!desk.cardText.includes('REQ_TAIL'));
  assert(!desk.cardText.includes('YDAY_NEW_TAIL'));
  assert(!desk.todayText.includes('PROGRESS_TAIL'));
  assert(!desk.todayText.includes('NEXT_TAIL'));
  assert(!desk.todayText.includes('REQ_TAIL'));
  assert(!desk.todayText.includes('EVENT_NEW_TAIL'));
  assert(desk.todayText.includes('当前进度'));
  assert(desk.todayText.includes('查看详情'));
  assert(desk.yText.includes('最新进展'));
  assert(!desk.yText.includes('NOTE_NOT_YDAY'));
  assert(!desk.yText.includes('YDAY_NEW_TAIL'));
  assert(!desk.yText.includes('YDAY_OLD_TAIL'));
  assert(!desk.yText.includes('YDAY_OLDER_TAIL'));
  console.log('✓ 桌面默认态紧凑：栏高 440，多条同屏，长文和要求未铺开', desk.cards.map((c) => c.h).join(','));

  await page.evaluate(() => {
    document.querySelector('.planner-grid').scrollTop = 80;
    window.scrollTo(0, 220);
  });
  const beforeScroll = await page.evaluate(() => ({g: document.querySelector('.planner-grid').scrollTop, y: window.scrollY}));
  assert(beforeScroll.g >= 40 && beforeScroll.y >= 100, JSON.stringify(beforeScroll));
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.daily-list li')].find((el) => el.textContent.includes('合成重点甲'));
    li.querySelector('.detail-open').click();
  });
  await page.waitForSelector('#detailDialog[open]');
  let detail = await readDetail();
  assert.equal(detail.workOpen, false);
  assert.equal(detail.title, '合成重点甲');
  assert.deepEqual(detail.headings, ['当天进展', '当前进度', '下一步', '具体制作要求', '进展记录']);
  assert(detail.progress.body.includes('PROGRESS_TAIL') && detail.progress.body.startsWith(fill('进', 20)));
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
  assert(detail.dates.includes('完成日') && detail.dates.includes('未完成'));
  assert.equal(await page.$$eval('script', (els) => els.length), 2);
  await closeDetail();
  const afterScroll = await page.evaluate(() => ({g: document.querySelector('.planner-grid').scrollTop, y: window.scrollY}));
  assert.equal(afterScroll.g, beforeScroll.g);
  assert.equal(afterScroll.y, beforeScroll.y);
  console.log('✓ 点击详情展示全文、独立要求和历史，关闭后滚动位置不变');

  await page.focus('.planner-card .detail-open');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#detailDialog[open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#detailDialog[open]'));
  assert((await page.evaluate(() => document.activeElement.className)).includes('detail-open'));
  await page.evaluate(() => document.querySelector('.planner-card .detail-open').click());
  await page.waitForSelector('#detailDialog[open]');
  const mask = await page.evaluate(() => {
    const r = document.getElementById('detailDialog').getBoundingClientRect();
    return {x: Math.max(4, r.left - 12), y: Math.max(4, r.top + 8)};
  });
  await page.mouse.click(mask.x, mask.y);
  await page.waitForFunction(() => !document.querySelector('#detailDialog[open]'));
  console.log('✓ ESC 与点击遮罩可关闭，焦点回到原按钮');

  await page.evaluate(() => [...document.querySelectorAll('.yesterday-list .detail-open')][0].click());
  await page.waitForSelector('#detailDialog[open]');
  detail = await readDetail();
  assert.equal(detail.title, '合成昨天重点');
  assert(detail.dayItems[0].text.includes('YDAY_NEW_TAIL') && detail.dayItems[1].text.includes('YDAY_OLD_TAIL'));
  assert(!detail.day.text.includes('NOTE_NOT_YDAY'));
  assert(!detail.day.text.includes('YDAY_OLDER_TAIL'));
  assert(detail.progress.body.includes('NOTE_NOT_YDAY'));
  assert.deepEqual(detail.history.map((it) => it.day), ['2026-11-17', '2026-11-17', '2026-11-10']);
  assert(detail.history[2].text.includes('YDAY_OLDER_TAIL'));
  assert(detail.dates.includes('原计划') && detail.dates.includes('2026-11-02'));
  assert(detail.dates.includes('计划交付') && detail.dates.includes('2026-11-30'));
  assert(!detail.req.body.includes('NOTE_NOT_YDAY'));
  await closeDetail();
  await page.evaluate(() => [...document.querySelectorAll('.week-item-btn')].find((b) => b.textContent.includes('合成昨天重点')).click());
  await page.waitForSelector('#detailDialog[open]');
  detail = await readDetail();
  assert.equal(detail.title, '合成昨天重点');
  assert(detail.progress.body.includes('NOTE_NOT_YDAY'));
  assert(!detail.headings.includes('当天进展'));
  assert(detail.headings.includes('具体制作要求') && detail.headings.includes('进展记录'));
  await closeDetail();
  console.log('✓ 昨天入口区分当天进展与当前进度；本周工作内容可打开同一详情');

  await open('?today=2026-11-18&edit=1&view=home');
  await page.evaluate(() => document.querySelector('.detail-open').click());
  await page.waitForSelector('#detailDialog[open]');
  assert.equal(await page.$eval('#workDialog', (el) => el.open), false);
  await closeDetail();
  await page.evaluate(() => document.querySelector('[data-edit="101"]').click());
  await page.waitForSelector('#workForm textarea[name=requirements]');
  assert.equal(await page.$eval('#detailDialog', (el) => el.open), false);
  assert((await page.$eval('#workForm textarea[name=requirements]', (el) => el.value)).includes('REQ_TAIL'));
  await page.click('#workDialog [data-act=close-dialog]');
  await page.waitForFunction(() => !document.querySelector('#workDialog[open]'));
  console.log('✓ 只读详情与维护模式编辑弹窗互不占用');

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
      btn: !!card.querySelector('.detail-open')
    };
  });
  assert(mobile.stacked, '窄屏应改为上下排列');
  assert(mobile.overflow <= 1);
  assert(mobile.cardW <= mobile.viewW);
  assert(mobile.btn);
  await page.evaluate(() => document.querySelector('.detail-open').click());
  await page.waitForSelector('#detailDialog[open]');
  const dlgW = await page.$eval('#detailDialog', (el) => el.getBoundingClientRect().width);
  assert(dlgW <= 390 - 8 && dlgW >= 280, '弹窗宽度 ' + dlgW);
  const mobileBody = await page.evaluate(() => {
    const body = document.querySelector('.detail-body');
    const wide = [...body.querySelectorAll('*')].map((el) => ({tag: el.tagName, cls: el.className, sw: el.scrollWidth, cw: el.clientWidth})).filter((el) => el.sw > el.cw + 1).slice(0, 8);
    return {sw: body.scrollWidth, cw: body.clientWidth, text: body.innerText.includes('NOTE_NOT_YDAY'), wide};
  });
  assert(mobileBody.text && mobileBody.sw <= mobileBody.cw + 1, JSON.stringify(mobileBody));
  await closeDetail();
  console.log('✓ 窄屏栏位上下排列，详情弹窗不撑破视口');

  assert.equal(errors.length, 0, errors.join('\n'));
  await browser.close();
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(root, {recursive: true, force: true});
  console.log('COMPACT_PASS');
})().catch((err) => { console.error('FAIL', err); process.exit(1); });
