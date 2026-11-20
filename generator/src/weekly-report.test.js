// 合成周报页面：历史深链接、空态、工序分行、转义。不读取真实工作库。
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

const THIS_COPY = '虚构甲周文案句子\n第二行 <b>不是标签</b> &</script><img src=x onerror=alert(1)>';
const THIS_LAND = '虚构甲周横版句子';
const THIS_PORT = '虚构甲周竖版句子';
const FOLLOW = '虚构甲周后续配音句子';
const CROSS_COPY = '虚构跨年脚本句子';
const CROSS_LAND = '虚构跨年横版句子';
const TASK = '虚构任务甲';
const TASK_EVENT = '虚构任务进展句子';

const srcDir = __dirname;
const task = (extra) => Object.assign({
  hidden: false, week: '2026-11-16', originalPlan: null, deadline: null, next: null, monthNotes: [],
  stages: null, shoot: null, initial: null, history: [], urgent: false, src: 'synthetic', handover: null
}, extra);
const social = [{seq: 1, month: '2026-10', date: '2026-10-08', title: '虚构社媒', content: '虚构社媒正文', work: '虚构栏目', note: '', status: '', link: null}];
const tasks = [
  task({id: 20261101, title: TASK, month: '2026-11', dateText: '11月18日', done: false, note: '虚构任务进度', plan: '2026-11-18', requirements: '虚构要求 <b>不是要求标签</b>', recordDay: '2026-11-18', sortDay: '2026-11-18', events: [
    {seq: 1, day: '2026-11-18', text: TASK_EVENT, done: false}
  ]}),
  task({id: 20250001, title: '虚构旧档', month: '2025-12', dateText: '12月1日', done: true, completed: '2025-12-01', note: '旧进度', plan: '2025-12-01', week: '2025-12-01', recordDay: '2025-12-01', sortDay: '2025-12-01', events: []})
];
const reports = [
  {
    week: '2026-11-16', timezone: 'Asia/Shanghai', updatedAt: '2026-11-18T09:00:00+08:00',
    projects: [{name: '虚构星河纪录', track: 'general', lines: [
      {emoji: '✅', process: '文案', status: '已定稿&<i>', text: THIS_COPY, aspect: '9:16'},
      {emoji: '🎬', process: '横版', status: '粗剪', text: THIS_LAND, aspect: '9:16'},
      {emoji: '📱', process: '竖版', status: '进行中', text: THIS_PORT, aspect: '16:9'},
      {emoji: '🎧', process: '配音', status: '已录', text: '虚构甲周旁白句子'}
    ]}],
    followups: [{name: '虚构星河纪录', track: 'general', lines: [
      {emoji: '📌', process: '配音', status: '待补', text: FOLLOW}
    ]}]
  },
  {
    week: '2025-12-29', timezone: 'Asia/Shanghai', updatedAt: '2026-01-02T09:00:00+08:00',
    projects: [{name: '虚构教室短片', track: 'education', lines: [
      {emoji: '📝', process: '脚本', status: '讨论中', text: CROSS_COPY},
      {emoji: '🎬', process: '横版', status: '未开始', text: CROSS_LAND},
      {emoji: '🏁', process: '片尾', status: '待做', text: '虚构跨年片尾句子'}
    ]}],
    followups: []
  }
];

function build(data, name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-wreport-'));
  fs.mkdirSync(path.join(root, 'restore', 'src'), {recursive: true});
  fs.mkdirSync(path.join(root, 'build'), {recursive: true});
  for (const file of ['app.js', 'app.html', 'build.py']) fs.copyFileSync(path.join(srcDir, file), path.join(root, 'restore', 'src', file));
  const dataPath = path.join(root, 'build', 'data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data));
  const out = path.join(root, 'restore', name);
  const built = spawnSync('python3', [path.join(srcDir, 'build.py')], {env: Object.assign({}, process.env, {
    LANGUI_ROOT: root, LANGUI_DATA: dataPath, LANGUI_HTML: out,
    LANGUI_PORTRAIT_URI: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  })});
  if (built.status !== 0) {
    console.error(built.stdout.toString(), built.stderr.toString());
    process.exit(1);
  }
  return {root, out};
}

const pageData = {version: 'synthetic', tasks, social, platforms: ['synthetic'], weeklyReports: reports};
const oldData = {version: 'synthetic', tasks, social, platforms: ['synthetic']};
const pageBuild = build(pageData, 'report.html');
const oldBuild = build(oldData, 'old.html');
const html = fs.readFileSync(pageBuild.out, 'utf8');
assert.equal((html.match(/<script/g) || []).length, 2, '周报正文里的 script 结束标记不得截断页面');
assert(html.includes('weekly-work-report') && html.includes('本周做了什么') && html.includes('整体汇报'));
console.log('✓ 构建保留两个脚本，并带上独立周报入口');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-wreport-chrome-'));
  const browser = await puppeteer.launch({executablePath: chrome, headless: 'new', userDataDir: dir, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const open = async (file, query) => {
    await page.goto('file://' + file + query, {waitUntil: 'load'});
    await page.waitForFunction('window.__LG_READY');
  };
  const reportOf = () => page.evaluate(() => {
    const root = document.querySelector('.wreport');
    if (!root) return null;
    const lines = (scope) => [...root.querySelectorAll(scope + ' .wreport-line')].map((el) => ({
      process: el.getAttribute('data-process'),
      emoji: el.querySelector('.wreport-emoji') ? el.querySelector('.wreport-emoji').textContent : '',
      name: el.querySelector('strong') ? el.querySelector('strong').textContent : '',
      aspect: el.querySelector('.wreport-aspect') ? el.querySelector('.wreport-aspect').textContent : '',
      status: el.querySelector('.wreport-status') ? el.querySelector('.wreport-status').textContent : '',
      text: el.querySelector('.wreport-text') ? el.querySelector('.wreport-text').textContent : '',
      html: el.querySelector('.wreport-text') ? el.querySelector('.wreport-text').innerHTML : '',
      first: el.querySelector('.wreport-line-head') ? el.querySelector('.wreport-line-head').firstElementChild.className : ''
    }));
    const follow = root.querySelector('.wreport-follow');
    const done = root.querySelector('.wreport-done');
    return {
      state: root.getAttribute('data-state'),
      week: root.getAttribute('data-week'),
      end: root.getAttribute('data-end'),
      text: root.innerText,
      tables: root.querySelectorAll('table').length,
      tags: root.querySelectorAll('img,script,b,i').length,
      times: [...root.querySelectorAll('time')].map((el) => el.getAttribute('datetime')),
      done: lines('.wreport-done'),
      later: lines('.wreport-later'),
      follow: follow ? follow.textContent : '',
      followAfter: !!(done && follow && (done.compareDocumentPosition(follow) & Node.DOCUMENT_POSITION_FOLLOWING)),
      buttons: [...document.querySelectorAll('.workspace-switch button')].map((el) => el.textContent)
    };
  });

  await open(pageBuild.out, '?today=2026-11-18&week=2025-12-29');
  const labels = await page.$$eval('.workspace-switch button', (els) => els.map((el) => el.textContent));
  assert.equal(labels.filter((label) => label === '本周工作汇报').length, 1);
  assert(labels.includes('本周做了什么') && labels.includes('整体汇报') && labels.includes('本周工作'));
  await page.click('.workspace-switch button[data-view="weekly-work-report"]');
  await page.waitForFunction(() => location.hash === '#weekly-work-report' && location.search.includes('week=2026-11-16'));
  let view = await reportOf();
  assert.equal(view.state, 'ready');
  assert.equal(view.week, '2026-11-16');
  assert.equal(view.end, '2026-11-22');
  assert.deepEqual(view.times, ['2026-11-16', '2026-11-22']);
  assert(!view.text.includes('今天'));
  assert(!view.text.includes(TASK) && !view.text.includes(TASK_EVENT));
  assert.equal(view.tables, 0);
  assert.equal(view.tags, 0);
  assert.equal(view.follow, '后续工作跟进');
  assert.equal(view.followAfter, true);
  assert.deepEqual(view.done.map((line) => line.process), ['文案', '横版', '竖版', '配音']);
  view.done.forEach((line) => {
    assert.equal(line.name, line.process);
    assert.equal(line.first, 'wreport-emoji');
  });
  assert(view.done[0].text.includes('虚构甲周文案句子') && view.done[0].text.includes('\n') && view.done[0].text.includes('第二行'));
  const copy = view.done[0];
  const land = view.done[1];
  const port = view.done[2];
  assert.equal(copy.emoji, '✅');
  assert.equal(copy.status, '已定稿&<i>');
  assert.equal(copy.aspect, '');
  assert(copy.text.includes('虚构甲周文案句子') && copy.text.includes('<b>不是标签</b>') && copy.text.includes('</script>'));
  assert(copy.html.includes('&lt;b&gt;') && !copy.html.includes('<b>') && !copy.html.includes('<img'));
  assert.equal(land.aspect, '16:9');
  assert.equal(land.status, '粗剪');
  assert.equal(land.text, THIS_LAND);
  assert(!land.text.includes(THIS_PORT));
  assert.equal(port.aspect, '9:16');
  assert.equal(port.text, THIS_PORT);
  assert(!port.text.includes('16:9'));
  assert.equal(view.later.length, 1);
  assert.equal(view.later[0].text, FOLLOW);
  assert(!view.text.slice(0, view.text.indexOf('后续工作跟进')).includes(FOLLOW));
  console.log('✓ 本周入口归一到周一，工序分行，横竖版独立，标记被转义');

  await page.evaluate(() => [...document.querySelectorAll('.wreport-nav a')].find((el) => el.textContent.trim() === '2025-12-29').click());
  await page.waitForFunction(() => document.querySelector('.wreport') && document.querySelector('.wreport').getAttribute('data-week') === '2025-12-29');
  view = await reportOf();
  assert.equal(view.state, 'ready');
  assert.deepEqual(view.times, ['2025-12-29', '2026-01-04']);
  assert.deepEqual(view.done.map((line) => line.process), ['脚本', '横版', '片尾']);
  assert.equal(view.done[0].status, '讨论中');
  assert.equal(view.done[0].text, CROSS_COPY);
  assert.equal(view.done[1].aspect, '16:9');
  assert.equal(view.done[1].status, '未开始');
  assert.equal(view.done[1].text, CROSS_LAND);
  assert.equal(view.follow, '后续工作跟进');
  assert(view.text.includes('没有后续跟进'));
  assert(!view.text.includes('虚构甲周文案句子'));
  console.log('✓ 历史深链接打开跨年周，不借用当前周正文');

  await open(pageBuild.out, '?today=2026-11-18&week=2026-01-03#weekly-work-report');
  view = await reportOf();
  assert.equal(view.week, '2025-12-29');
  assert.equal(view.done[0].text, CROSS_COPY);
  await open(pageBuild.out, '?today=2026-11-18&week=2026-11-12#weekly-work-report');
  view = await reportOf();
  assert.equal(view.state, 'empty');
  assert.equal(view.week, '2026-11-09');
  assert.equal(view.end, '2026-11-15');
  assert.deepEqual(view.times, ['2026-11-09', '2026-11-15']);
  assert.equal(view.done.length, 0);
  assert.equal(view.follow, '');
  assert(!view.text.includes('虚构甲周') && !view.text.includes('虚构跨年') && !view.text.includes(TASK));
  assert(view.text.includes('还没有工作汇报'));
  console.log('✓ 没有记录的历史周保持空态');

  await open(pageBuild.out, '?today=2026-11-18&week=2026-13-40#weekly-work-report');
  view = await reportOf();
  assert.equal(view.state, 'invalid');
  assert(!view.text.includes('虚构甲周') && !view.text.includes('虚构跨年'));
  await open(pageBuild.out, '?today=2026-11-18#weekly-work-report');
  view = await reportOf();
  assert.equal(view.week, '2026-11-16');
  assert(view.text.includes('虚构甲周文案句子'));
  assert(!view.text.includes(CROSS_COPY));

  await page.click('.workspace-switch button[data-view="weekly-record"]');
  await page.waitForFunction(() => location.hash === '#weekly-record');
  const record = await page.$eval('.weekly-recap', (el) => el.innerText);
  assert(record.includes('本周做了什么') && record.includes(TASK_EVENT));
  assert(!record.includes('虚构甲周文案句子'));
  await page.click('.workspace-switch button[data-view="weekly-report"]');
  await page.waitForFunction(() => location.hash === '#weekly-report');
  const speech = await page.$eval('.weekly-speech', (el) => el.innerText);
  assert(speech.includes('整体汇报词'));
  assert(!speech.includes('虚构甲周文案句子'));
  await page.click('.workspace-switch button[data-view="social"]');
  await page.waitForFunction(() => location.hash === '#social-media');
  const socialText = await page.$eval('.social-board', (el) => el.innerText);
  assert(socialText.includes('虚构社媒') && socialText.includes('虚构社媒正文'));
  await page.click('.workspace-switch button[data-view="week"]');
  await page.waitForFunction(() => location.hash === '');
  const weekText = await page.$eval('#workspace', (el) => el.innerText);
  assert(weekText.includes(TASK) && weekText.includes('虚构任务进度'));
  assert(!weekText.includes('虚构甲周文案句子'));
  console.log('✓ 原有本周、社媒、做了什么、整体汇报仍读任务，不读周报');

  await open(oldBuild.out, '?today=2026-11-18#weekly-work-report');
  view = await reportOf();
  assert.equal(view.state, 'empty');
  assert.equal(view.week, '2026-11-16');
  assert(!view.text.includes('虚构甲周'));
  assert.equal(errors.length, 0, errors.join('\n'));
  const oldWeek = await page.evaluate(() => {
    document.querySelector('.workspace-switch button[data-view="week"]').click();
    return document.querySelector('#workspace').innerText;
  });
  assert(oldWeek.includes(TASK));
  console.log('✓ 旧数据没有周报字段时为空态，任务仍在');

  await browser.close();
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(pageBuild.root, {recursive: true, force: true});
  fs.rmSync(oldBuild.root, {recursive: true, force: true});
  console.log('PAGE_PASS');
})().catch((err) => { console.error('FAIL', err); process.exit(1); });
