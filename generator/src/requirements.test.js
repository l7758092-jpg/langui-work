// 合成数据：具体制作要求、进度互不覆盖、旧记录、周末与年份。不读取真实工作库。
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

const REQ = '第一行\n第二行 <b>不是标签</b> 中文「要求」&</script>';
const srcDir = __dirname;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-req-'));
fs.mkdirSync(path.join(root, 'restore', 'src'), {recursive: true});
fs.mkdirSync(path.join(root, 'build'), {recursive: true});
for (const name of ['app.js', 'app.html', 'build.py']) fs.copyFileSync(path.join(srcDir, name), path.join(root, 'restore', 'src', name));
const data = {
  version: 'synthetic',
  tasks: [
    {id: 20260001, title: '合成进度任务', month: '2026-11', hidden: false, dateText: '11月16日', done: false, note: '仅进度说明', plan: '2026-11-16', week: '2026-11-16', originalPlan: null, deadline: null, next: '下一步保持', monthNotes: [], stages: null, shoot: null, initial: null, events: [{seq: 1, day: '2026-11-13', text: '周五进展', done: false}], history: [], urgent: false, src: 'synthetic', recordDay: '2026-11-16', sortDay: '2026-11-16', handover: null, requirements: REQ},
    {id: 20260002, title: '合成无要求', month: '2026-11', hidden: false, dateText: '11月10日', done: false, note: '旧进度不应变成要求', plan: '2026-11-10', week: '2026-11-09', originalPlan: null, deadline: null, next: null, monthNotes: [], stages: null, shoot: null, initial: null, events: [], history: [], urgent: false, src: 'synthetic', recordDay: '2026-11-10', sortDay: '2026-11-10', handover: null},
    {id: 20250001, title: '合成去年', month: '2025-12', hidden: false, dateText: '12月1日', done: true, note: '去年进度', plan: '2025-12-01', week: '2025-12-01', originalPlan: null, deadline: null, next: null, monthNotes: [], stages: null, shoot: null, initial: null, events: [], history: [], urgent: false, src: 'synthetic', recordDay: '2025-12-01', sortDay: '2025-12-01', handover: null, requirements: ''},
    {id: 20270001, title: '合成明年', month: '2027-01', hidden: false, dateText: '1月4日', done: false, note: '明年进度', plan: '2027-01-04', week: '2027-01-04', originalPlan: null, deadline: null, next: null, monthNotes: [], stages: null, shoot: null, initial: null, events: [], history: [], urgent: false, src: 'synthetic', recordDay: '2027-01-04', sortDay: '2027-01-04', handover: null}
  ],
  social: [],
  platforms: []
};
const dataPath = path.join(root, 'build', 'data.json');
fs.writeFileSync(dataPath, JSON.stringify(data));
const out = path.join(root, 'restore', 'out.html');
const built = spawnSync('python3', [path.join(srcDir, 'build.py')], {
  env: Object.assign({}, process.env, {
    LANGUI_ROOT: root,
    LANGUI_DATA: dataPath,
    LANGUI_HTML: out,
    LANGUI_PORTRAIT_URI: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  })
});
if (built.status !== 0) { console.error(built.stdout.toString(), built.stderr.toString()); process.exit(1); }
const html = fs.readFileSync(out, 'utf8');
assert(html.includes('weekendShanghai') && html.includes('archiveMonth') && html.includes('id="totalLabel"'));
assert.equal((html.match(/<script>/g) || []).length, 2, '要求里的 script 结束标记不得截断页面脚本');
assert(!html.includes('仅进度说明</b>'));
console.log('✓ 构建保留周末/年份脚本，并把要求中的 </ 转义进数据');

const FILE = 'file://' + out;
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-req-chrome-'));
  const browser = await puppeteer.launch({executablePath: chrome, headless: 'new', userDataDir: dir, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('dialog', (d) => d.accept());
  const open = async (q) => {
    await page.goto(FILE + q, {waitUntil: 'load'});
    await page.waitForFunction('window.__LG_READY');
  };
  const card = (title) => page.evaluate((t) => {
    const el = [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4') && c.querySelector('h4').textContent === t);
    if (!el) return null;
    return {
      text: el.innerText,
      hints: [...el.querySelectorAll('.planner-hint')].map((x) => x.textContent),
      preview: el.querySelector('.planner-preview') ? el.querySelector('.planner-preview').textContent : '',
      button: el.querySelector('.planner-card-actions .detail-open') ? el.querySelector('.planner-card-actions .detail-open').textContent : '',
      hasReqBlock: !!el.querySelector('.inline-detail:not([hidden]) .inline-req, .planner-requirements')
    };
  }, title);
  const readDetail = () => page.evaluate(() => {
    const root = document.querySelector('.planner-card.is-expanded');
    const panel = root.querySelector('.inline-detail');
    const section = (name) => {
      const h = [...panel.querySelectorAll('h4')].find((x) => x.textContent.trim() === name);
      if (!h) return { text: '', html: '' };
      const p = h.parentElement.querySelector('p');
      return { text: p ? p.textContent : '', html: p ? p.innerHTML : '' };
    };
    const req = section('具体制作要求');
    return {
      req: req.text,
      reqHtml: req.html,
      hasTag: !!panel.querySelector('.inline-req b'),
      progress: section('当前进度').text,
      next: section('下一步').text,
      dialogs: document.querySelectorAll('dialog[open]').length
    };
  });
  const openCard = async (title) => {
    await page.evaluate((t) => {
      const el = [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4') && c.querySelector('h4').textContent === t);
      el.querySelector('.planner-card-actions .detail-open').click();
    }, title);
    await page.waitForFunction((t) => {
      const el = [...document.querySelectorAll('.planner-card')].find((c) => c.querySelector('h4') && c.querySelector('h4').textContent === t);
      return el.classList.contains('is-expanded') && document.querySelectorAll('dialog[open]').length === 0;
    }, {}, title);
  };
  const closeDetail = async () => {
    await page.evaluate(() => document.querySelector('.planner-card.is-expanded .planner-card-actions .detail-open').click());
    await page.waitForFunction(() => !document.querySelector('.planner-card.is-expanded'));
  };
  await open('?today=2026-11-16&view=home');
  const shown = await card('合成进度任务');
  assert(shown, '排期卡片缺失');
  assert.equal(shown.button, '展开详情');
  assert(shown.hints.includes('含制作要求'));
  assert.equal(shown.hasReqBlock, false);
  assert(shown.preview.includes('仅进度说明'));
  assert(!shown.text.includes('第二行'));
  assert(!shown.text.includes('不是标签'));
  assert(!shown.text.includes('下一步保持'));
  await openCard('合成进度任务');
  const shownDetail = await readDetail();
  assert.equal(shownDetail.dialogs, 0);
  assert.equal(shownDetail.req, REQ);
  assert.equal(shownDetail.hasTag, false);
  assert(!shownDetail.reqHtml.includes('<b>'));
  assert(!shownDetail.reqHtml.includes('</script>'));
  assert.equal(shownDetail.progress, '仅进度说明');
  assert.equal(shownDetail.next, '下一步保持');
  assert(!shownDetail.progress.includes('第一行'));
  await closeDetail();
  const plain = await card('合成无要求');
  assert(plain && plain.hasReqBlock === false && !plain.hints.includes('含制作要求') && plain.preview.includes('旧进度不应变成要求'));
  await openCard('合成无要求');
  const plainDetail = await readDetail();
  assert.equal(plainDetail.req, '');
  assert.equal(plainDetail.progress, '旧进度不应变成要求');
  await closeDetail();
  const yEmpty = await page.$eval('.planner-yesterday .planner-empty', (el) => el.textContent);
  const yMeta = await page.$eval('.planner-yesterday small', (el) => el.textContent);
  assert.equal(yEmpty, '休息');
  assert(yMeta.includes('11/15'));
  assert.equal(await page.$eval('#total', (el) => el.textContent), '2');
  assert.equal(await page.$eval('#totalLabel', (el) => el.textContent), '2026年工作记录');
  assert.equal(await page.$eval('#brandDate', (el) => el.getAttribute('datetime')), '2026-11-16');
  console.log('✓ 要求多行/转义/中文独立展示，进度和下一步不变；周日无记录显示休息');

  await open('?today=2026-11-14&view=home');
  const fri = await page.evaluate(() => ({
    empty: document.querySelector('.planner-yesterday .planner-empty')?.textContent || '',
    items: document.querySelectorAll('.planner-yesterday .yesterday-list li').length,
    meta: document.querySelector('.planner-yesterday small')?.textContent || ''
  }));
  assert.equal(fri.empty, '');
  assert(fri.items > 0 && fri.meta.includes('11/13'));
  console.log('✓ 周五有进展时不显示休息');

  await open('?today=2026-11-18&view=home');
  assert.equal(await page.$eval('.planner-yesterday .planner-empty', (el) => el.textContent), '昨天暂无工作记录');
  assert.equal(await page.$eval('.planner-today .planner-empty', (el) => el.textContent), '今天暂无工作安排');
  console.log('✓ 工作日空状态保持原样');

  await open('?today=2026-11-16&view=home');
  await page.click('#years a[data-month="2025-12"]');
  await page.waitForFunction(() => location.search.includes('month=2025-12'));
  assert.equal(await page.$eval('#total', (el) => el.textContent), '1');
  assert.equal(await page.$eval('.ledger-period strong', (el) => el.textContent), '2025年12月');
  assert.equal(await page.$eval('.planner-today .planner-empty', (el) => el.textContent.startsWith('今天是2026年11月16日')), true);
  assert.equal(await page.$$eval('.planner-today .daily-list li', (els) => els.length), 0);
  await page.click('a[data-month="2025-01"]');
  await page.waitForFunction(() => location.search.includes('month=2025-01'));
  assert.equal(await page.$eval('.ledger-empty', (el) => el.textContent), '这个月没有工作记录。');
  await page.click('#years a[data-month="2027-01"]');
  await page.waitForFunction(() => location.search.includes('month=2027-01'));
  assert.equal(await page.$eval('#total', (el) => el.textContent), '1');
  assert.equal(await page.$eval('.ledger-period strong', (el) => el.textContent), '2027年1月');
  assert.equal(await page.$$eval('.planner-requirements', (els) => els.length), 0);
  assert.equal(await page.$$eval('.planner-hint', (els) => els.filter((el) => el.textContent === '含制作要求').length), 0);
  assert.equal(await page.evaluate(() => document.body.innerText.includes('第一行')), false);
  const times = await page.$$eval('.planner-range time', (els) => els.map((el) => el.getAttribute('datetime')));
  assert(times.every((t) => t.startsWith('2027-01')));
  await page.click('#years a[data-month="2026-11"]');
  await page.waitForFunction(() => location.search.includes('month=2026-11'));
  assert.equal(await page.$eval('#total', (el) => el.textContent), '2');
  await openCard('合成进度任务');
  assert.equal((await readDetail()).req.startsWith('第一行'), true);
  await closeDetail();
  const back = await card('合成进度任务');
  assert(back && back.preview.includes('仅进度说明') && !back.text.includes('第二行'));
  console.log('✓ 年份切换、空月、明年不冒充要求，切回 2026 后要求仍在');

  await page.evaluate(() => {
    localStorage.setItem('langui-work-v3', JSON.stringify({v: 3, work: {'20260001': {id: 20260001, title: '合成进度任务', month: '2026-11', date: '11月16日', progress: '本地改过的进度', done: false, planned: '2026-11-16', week: '2026-11-16', nextStep: '下一步保持'}}, addedEvents: [], social: {}, priorities: {}, deadlines: {}, videoStages: {}}));
  });
  await page.reload({waitUntil: 'load'});
  await page.waitForFunction('window.__LG_READY');
  const kept = await card('合成进度任务');
  assert(kept.preview.includes('本地改过的进度'));
  assert(!kept.text.includes('第二行'));
  await openCard('合成进度任务');
  assert((await readDetail()).req.startsWith('第一行'));
  await closeDetail();
  console.log('✓ 旧的本地覆盖层没有要求字段时，仍保留数据里的要求');

  await page.evaluate(() => localStorage.clear());
  await open('?today=2026-11-16&edit=1&view=home');
  await page.evaluate(() => document.querySelector('[data-edit="20260001"]').click());
  await page.waitForSelector('#workForm textarea[name=requirements]');
  const hint = await page.$eval('#workForm', (el) => el.innerText);
  assert(hint.includes('只保存在这台浏览器'));
  await page.$eval('#workForm input[name=progress]', (el) => { el.value = '本地新进度'; });
  await page.click('#workForm .work-button');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  let after = await card('合成进度任务');
  assert(after.preview.includes('本地新进度'));
  assert(after.hints.includes('含制作要求'));
  await openCard('合成进度任务');
  assert((await readDetail()).req.startsWith('第一行'));
  assert.equal((await readDetail()).progress, '本地新进度');
  await closeDetail();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('langui-work-v3')).work['20260001']);
  assert(saved.requirements.startsWith('第一行'));
  assert.equal(saved.progress, '本地新进度');
  await page.evaluate(() => document.querySelector('[data-edit="20260001"]').click());
  await page.$eval('#workForm textarea[name=requirements]', (el) => { el.value = ''; });
  await page.click('#workForm .work-button');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  after = await card('合成进度任务');
  assert(!after.hints.includes('含制作要求'));
  assert(after.preview.includes('本地新进度'));
  await openCard('合成进度任务');
  const cleared = await readDetail();
  assert.equal(cleared.req, '');
  assert.equal(cleared.progress, '本地新进度');
  await closeDetail();
  console.log('✓ 维护模式只写入 localStorage：改进度不丢要求，清空要求不改进度');

  assert.equal(errors.length, 0, errors.join('\n'));
  await browser.close();
  fs.rmSync(dir, {recursive: true, force: true});
  fs.rmSync(root, {recursive: true, force: true});
  console.log('PAGE_PASS');
})().catch((err) => { console.error('FAIL', err); process.exit(1); });
