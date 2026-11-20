// 合成数据：今天/昨天显示、此前已完成与新安排、周末和年份。不读取真实工作库。
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const assert = require('assert');
const puppeteer = require(process.env.PUPPETEER_CORE || (() => { try { return require.resolve('puppeteer-core'); } catch (e) { return '/workspace/langui/test/node_modules/puppeteer-core'; } })());
const chrome = ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
assert(chrome, '找不到 Chrome');

const srcDir = __dirname;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-today-'));
fs.mkdirSync(path.join(root, 'restore', 'src'), {recursive: true});
fs.mkdirSync(path.join(root, 'build'), {recursive: true});
for (const name of ['app.js', 'app.html', 'build.py']) fs.copyFileSync(path.join(srcDir, name), path.join(root, 'restore', 'src', name));
const task = (extra) => Object.assign({hidden: false, week: '2026-11-16', originalPlan: null, deadline: null, next: null, monthNotes: [], stages: null, shoot: null, initial: null, history: [], urgent: false, src: 'synthetic', handover: null, requirements: null}, extra);
const data = {
  version: 'synthetic',
  tasks: [
    task({id: 1, title: '合成再修改', month: '2026-11', dateText: '11月27日成片', done: true, completed: '2026-11-13', note: '当前竖版安排', plan: '2026-11-18', next: '今天做竖版', requirements: '要求保留', recordDay: '2026-11-13', sortDay: '2026-11-18', events: [
      {seq: 10, day: '2026-11-18', text: '旧的改期说明', done: false},
      {seq: 11, day: '2026-11-18', text: '更旧的安排', done: false},
      {seq: 9, day: '2026-11-13', text: '较早的完成记录', done: true}
    ]}),
    task({id: 2, title: '合成当日进展', month: '2026-11', dateText: '11月10日', done: true, completed: '2026-11-10', note: '不要当成今天的安排', plan: '2026-11-10', recordDay: '2026-11-10', sortDay: '2026-11-10', events: [
      {seq: 20, day: '2026-11-18', text: '今天才发生的进展', done: false}
    ]}),
    task({id: 3, title: '合成当天完成', month: '2026-11', dateText: '11月18日', done: true, completed: '2026-11-18', note: '完成说明', plan: '2026-11-18', recordDay: '2026-11-18', sortDay: '2026-11-18', events: [
      {seq: 30, day: '2026-11-18', text: '完成说明', done: true}
    ]}),
    task({id: 4, title: '合成未完成', month: '2026-11', dateText: '11月18日', done: false, note: '未完成进度', plan: '2026-11-18', next: '继续做', recordDay: '2026-11-18', sortDay: '2026-11-18', events: []}),
    task({id: 5, title: '合成后天', month: '2026-11', dateText: '11月19日', done: false, note: '后天的说明', plan: '2026-11-19', requirements: '后天要求', recordDay: '2026-11-18', sortDay: '2026-11-19', events: [
      {seq: 40, day: '2026-11-18', text: '建档记录', done: false}
    ]}),
    task({id: 6, title: '合成昨天', month: '2026-11', dateText: '11月17日', done: false, note: '今天的说明不能算昨天', plan: '2026-11-16', recordDay: '2026-11-17', sortDay: '2026-11-17', events: [
      {seq: 1, day: '2026-11-17', text: '昨天旧记录', done: false},
      {seq: 2, day: '2026-11-17', text: '昨天最新记录', done: false}
    ]}),
    task({id: 7, title: '合成去年', month: '2025-12', dateText: '12月1日', done: true, completed: '2025-12-01', note: '去年进度', plan: '2025-12-01', week: '2025-12-01', recordDay: '2025-12-01', sortDay: '2025-12-01', events: []})
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

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-today-chrome-'));
  const browser = await puppeteer.launch({executablePath: chrome, headless: 'new', userDataDir: dir, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 900});
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const open = async (q) => { await page.goto('file://' + out + q, {waitUntil: 'load'}); await page.waitForFunction('window.__LG_READY'); };
  const item = (sel, title) => page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s + ' li')].find((li) => li.querySelector('strong') && li.querySelector('strong').textContent === t);
    if (!el) return null;
    return {
      badge: el.querySelector('.daily-kind')?.textContent || '',
      text: el.innerText,
      hints: [...el.querySelectorAll('.planner-hint')].map((x) => x.textContent),
      button: el.querySelector('.detail-open')?.textContent || '',
      historyOpen: !!el.querySelector('.day-history[open], .detail-timeline')
    };
  }, sel, title);
  const readDetail = () => page.evaluate(() => {
    const dlg = document.getElementById('detailDialog');
    const section = (name) => {
      const h = [...dlg.querySelectorAll('h4')].find((x) => x.textContent.trim() === name);
      return h ? h.parentElement.innerText : '';
    };
    const history = [...dlg.querySelectorAll('.detail-history li')].map((li) => li.innerText);
    return { progress: section('当前进度'), next: section('下一步'), req: section('具体制作要求'), day: section('当天进展'), history, dates: dlg.querySelector('.detail-dates')?.innerText || '' };
  });
  const openItem = async (sel, title) => {
    await page.evaluate((s, t) => {
      const el = [...document.querySelectorAll(s + ' li')].find((li) => li.querySelector('strong') && li.querySelector('strong').textContent === t);
      el.querySelector('.detail-open').click();
    }, sel, title);
    await page.waitForSelector('#detailDialog[open]');
  };
  const closeDetail = async () => {
    await page.click('#detailDialog [data-detail-close]');
    await page.waitForFunction(() => !document.querySelector('#detailDialog[open]'));
  };
  await open('?today=2026-11-18&view=home');
  const again = await item('.daily-list', '合成再修改');
  assert(again, '再修改任务应出现在今天');
  assert.equal(again.badge, '本轮安排');
  assert.equal(again.button, '查看详情');
  assert(again.text.includes('当前进度') && again.text.includes('当前竖版安排'));
  assert(again.text.includes('此前已完成') && again.text.includes('2026-11-13'));
  assert(!again.text.includes('初稿'));
  assert(!again.text.includes('旧的改期说明'));
  assert(!again.text.includes('今天做竖版'));
  assert.equal(again.historyOpen, false);
  await openItem('.daily-list', '合成再修改');
  const againDetail = await readDetail();
  assert(againDetail.progress.includes('当前竖版安排'));
  assert(againDetail.next.includes('今天做竖版'));
  assert(againDetail.dates.includes('2026-11-13'));
  assert(againDetail.history.some((l) => l.includes('旧的改期说明')) && againDetail.history.some((l) => l.includes('更旧的安排')));
  assert(!againDetail.progress.includes('初稿') && !againDetail.day.includes('初稿'));
  await closeDetail();
  const progressOnly = await item('.daily-list', '合成当日进展');
  assert(progressOnly && progressOnly.badge === '当天进展' && progressOnly.text.includes('今天才发生的进展'));
  assert(!progressOnly.text.includes('不要当成今天的安排'));
  await openItem('.daily-list', '合成当日进展');
  const progressDetail = await readDetail();
  assert(progressDetail.day.includes('今天才发生的进展') && !progressDetail.day.includes('不要当成今天的安排'));
  assert(progressDetail.progress.includes('不要当成今天的安排'));
  await closeDetail();
  const finished = await item('.daily-list', '合成当天完成');
  assert(finished && finished.badge === '已完成');
  const openTask = await item('.daily-list', '合成未完成');
  assert(openTask && openTask.badge === '今日安排' && openTask.text.includes('未完成进度'));
  assert.equal(await item('.daily-list', '合成后天'), null);
  const titles = await page.$$eval('.planner-card h4', (els) => els.map((el) => el.textContent));
  assert(titles.includes('合成后天') && titles.includes('合成再修改'));
  const weekRow = await page.evaluate(() => {
    const open = document.querySelector('.week-status-group.is-open');
    const li = [...open.querySelectorAll('li')].find((el) => el.textContent.includes('合成再修改'));
    return {inOpen: !!li, check: li ? !!li.querySelector('.week-done-check') : false, doneGroupHas: [...document.querySelectorAll('.week-status-group.is-done li')].some((el) => el.textContent.includes('合成再修改'))};
  });
  assert(weekRow.inOpen && !weekRow.check && !weekRow.doneGroupHas);
  const doneRow = await page.evaluate(() => {
    const done = document.querySelector('.week-status-group.is-done');
    const li = [...done.querySelectorAll('li')].find((el) => el.textContent.includes('合成当天完成'));
    return {inDone: !!li, check: li ? !!li.querySelector('.week-done-check') : false, cue: li ? li.textContent.includes('详情') : false};
  });
  assert(doneRow.inDone && doneRow.check && doneRow.cue);
  const roundLabel = await page.evaluate(() => [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4')?.textContent === '合成再修改')?.textContent || '');
  assert(roundLabel.includes('此前已完成') && roundLabel.includes('本轮安排') === false);
  assert(!roundLabel.includes('初稿'));
  const ticks = await page.evaluate(() => [...document.querySelectorAll('.ledger-scroll tbody tr')].filter((tr) => tr.children[1].textContent.includes('合成再修改')).map((tr) => ({date: tr.children[0].textContent.trim(), tick: !!tr.querySelector('.ledger-tick')})));
  assert(ticks.some((row) => row.date === '2026-11-13' && row.tick));
  assert(ticks.some((row) => row.date === '2026-11-18' && !row.tick));
  const doneTicks = await page.evaluate(() => [...document.querySelectorAll('.ledger-scroll tbody tr')].filter((tr) => tr.children[1].textContent.includes('合成当天完成')).map((tr) => ({date: tr.children[0].textContent.trim(), tick: !!tr.querySelector('.ledger-tick')})));
  assert(doneTicks.some((row) => row.date === '2026-11-18' && row.tick));
  const y = await item('.yesterday-list', '合成昨天');
  assert(y && y.text.includes('昨天最新记录') && !y.text.includes('昨天旧记录'));
  assert(!y.text.includes('今天的说明不能算昨天'));
  await openItem('.yesterday-list', '合成昨天');
  const yDetail = await readDetail();
  assert(yDetail.day.includes('昨天最新记录') && yDetail.day.includes('昨天旧记录'));
  assert(!yDetail.day.includes('今天的说明不能算昨天'));
  assert(yDetail.progress.includes('今天的说明不能算昨天'));
  assert(yDetail.history.some((l) => l.includes('昨天旧记录')));
  await closeDetail();
  assert((await page.$eval('.planner-yesterday li strong', (el) => el.textContent)) === '合成昨天');
  const reqCard = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4')?.textContent === '合成再修改');
    return { hints: [...card.querySelectorAll('.planner-hint')].map((x) => x.textContent), text: card.innerText };
  });
  assert(reqCard.hints.includes('含制作要求') && !reqCard.text.includes('要求保留'));
  await page.evaluate(() => [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4')?.textContent === '合成再修改').querySelector('.detail-open').click());
  await page.waitForSelector('#detailDialog[open]');
  const reqDetail = await readDetail();
  assert(reqDetail.req.includes('要求保留'));
  assert(!reqDetail.progress.includes('要求保留') && !reqDetail.next.includes('要求保留'));
  await closeDetail();
  console.log('✓ 新安排、当天进展、完成归属、未来计划、昨天记录和要求字段');

  await open('?today=2026-11-15&view=home');
  assert.equal(await page.$eval('.planner-yesterday .planner-empty', (el) => el.textContent), '休息');
  console.log('✓ 周末无记录仍显示休息');

  await open('?today=2026-11-18&view=home');
  await page.click('#years a[data-month="2025-12"]');
  await page.waitForFunction(() => location.search.includes('month=2025-12'));
  assert.equal(await page.$eval('#total', (el) => el.textContent), '1');
  assert.equal(await page.$eval('.ledger-period strong', (el) => el.textContent), '2025年12月');
  await page.click('#years a[data-month="2026-11"]');
  await page.waitForFunction(() => location.search.includes('month=2026-11'));
  assert.equal(await item('.daily-list', '合成再修改') != null, true);
  console.log('✓ 年份筛选后切回，今天的新安排仍在');

  assert.equal(errors.length, 0, errors.join('\n'));
  await browser.close();
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(root, {recursive: true, force: true});
  console.log('TODAY_PASS');
})().catch((err) => { console.error('FAIL', err); process.exit(1); });
