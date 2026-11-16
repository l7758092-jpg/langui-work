"""LanGui 专业工作库：读写 data.json + 发布流水线（备份→修改→build→测试→推送→核对线上→备份到 store）。"""
import copy, datetime, fcntl, hashlib, json, os, re, shutil, subprocess, tempfile, threading, time, urllib.request
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Asia/Shanghai')
ROOT = os.environ.get('LANGUI_ROOT', '/workspace/langui').rstrip('/')
DATA = ROOT + '/build/data.json'
BUILD = ROOT + '/restore/src/build.py'
HTML = ROOT + '/restore/LanGui专业工作库.html'
TESTS = [ROOT + '/restore/src/flow.test.js', ROOT + '/restore/src/migrate.test.js']
PUBLISH = os.environ.get('LANGUI_PUBLISH', '1') == '1'
REPO = os.environ.get('LANGUI_REPO', 'l7758092-jpg/langui-work')
PAGES = os.environ.get('LANGUI_PAGES', 'https://l7758092-jpg.github.io/langui-work/')
STORE_BACKUP = os.environ.get('LANGUI_STORE_BACKUP', '/cursor/stores/store-a91dd842-ea15-4b6b-8f9e-5f3ed193ee4a/langui/build/data.json')
BACKUP_DIR = os.environ.get('LANGUI_BACKUP_DIR', ROOT + '/build/backups')
LOCK = ROOT + '/.langui-write.lock'
GIT_NAME, GIT_EMAIL = 'l7758092-jpg', '344235615+l7758092-jpg@users.noreply.github.com'
ENV = dict(os.environ, HOME=os.environ.get('HOME', '/home/box'), TZ='Asia/Shanghai',
           PATH='/usr/local/bin:/usr/bin:/bin:' + os.environ.get('PATH', ''))
_tlock = threading.Lock()
WD = '一二三四五六日'

# ── 日期 ──
def today():
    return os.environ.get('LANGUI_TODAY') or datetime.datetime.now(TZ).date().isoformat()
def valid(d):
    try: return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', d)) and datetime.date.fromisoformat(d).isoformat() == d
    except Exception: return False
def need_day(d, name='日期'):
    d = (d or '').strip() or today()
    if not valid(d): raise ValueError(f'{name}格式应为 YYYY-MM-DD：{d}')
    return d
def monday(d):
    x = datetime.date.fromisoformat(d); return (x - datetime.timedelta(days=x.weekday())).isoformat()
def shift(d, n): return (datetime.date.fromisoformat(d) + datetime.timedelta(days=n)).isoformat()
def cn(d):
    x = datetime.date.fromisoformat(d); return f'{x.month}月{x.day}日'
def label(d): return f'{d}（周{WD[datetime.date.fromisoformat(d).weekday()]}）'

# ── 读数据 ──
def load():
    with open(DATA, encoding='utf-8') as f: return json.load(f)
def dump(data):
    return json.dumps(data, ensure_ascii=False, indent=1)

def actual_day(t):
    if t.get('completed'): return t['completed']
    dt = t.get('dateText') or ''
    if valid(dt): return dt
    m = re.match(r'^(\d{1,2})月(\d{1,2})日(?:下午|上午|\s.*)?$', dt)
    if m and t.get('month'): return f"{t['month'][:4]}-{int(m[1]):02d}-{int(m[2]):02d}"
    return None

def clean_requirements(value):
    """把明确传入的制作要求收成字符串或 None。None 不在这里表示「不修改」。"""
    if not isinstance(value, str): raise ValueError('具体制作要求须为文字')
    text = value.replace('\r\n', '\n').strip()
    if len(text) > 4000: raise ValueError('具体制作要求请少于 4000 字')
    return text or None

def brief(t, events_for=None):
    r = {'id': t['id'], '标题': t['title'], '完成': bool(t['done']), '说明': t.get('note') or ''}
    if t.get('requirements'): r['具体制作要求'] = t['requirements']
    for k, n in (('plan', '计划日'), ('originalPlan', '原计划'), ('deadline', '交付'), ('completed', '完成日'), ('next', '下一步'), ('dateText', '日期'), ('month', '月份')):
        if t.get(k): r[n] = t[k]
    if t.get('urgent'): r['急'] = True
    if t.get('hidden'): r['隐藏'] = True
    if events_for is not None:
        ev = [e for e in t.get('events') or [] if events_for(e['day'])]
        if ev: r['进展'] = [f"{e['day']} {e['text']}" + ('（完成）' if e.get('done') else '') for e in ev]
    return r

def find_task(data, task):
    T = data['tasks']; s = str(task).strip()
    if not s: raise ValueError('请给任务编号或名称')
    if re.fullmatch(r'\d{8}', s):
        for t in T:
            if t['id'] == int(s): return t
        raise ValueError(f'没有编号为 {s} 的任务')
    exact = [t for t in T if t['title'] == s]
    if len(exact) == 1: return exact[0]
    norm = lambda x: re.sub(r'[\s《》“”"\'（）()]', '', x).lower()
    sub = exact or [t for t in T if norm(s) in norm(t['title'])]
    if len(sub) > 1:
        open_ = [t for t in sub if not t['done'] and not t.get('hidden')]
        if len(open_) == 1: return open_[0]
        raise ValueError('匹配到多条任务，请用编号指定：' + '；'.join(f"{t['id']} {t['title']}{'（已完成）' if t['done'] else ''}" for t in sub[:15]))
    if sub: return sub[0]
    raise ValueError(f'找不到任务「{s}」，可先用 list_tasks 搜索')

def get_day(day=None):
    data = load(); d = need_day(day); T = data['tasks']
    sched = [t for t in T if t.get('plan') == d and not t['done']]
    fin = [t for t in T if t.get('plan') == d and t['done'] and actual_day(t) == d]
    other_done = [t for t in T if t['done'] and t.get('completed') == d and t.get('plan') != d]
    prog = [t for t in T if any(e['day'] == d for e in t.get('events') or []) and t not in sched + fin + other_done]
    dl = [t for t in T if t.get('deadline') == d and not t['done']]
    sched.sort(key=lambda t: (not t.get('urgent'), t['id']))
    on = lambda x: x == d
    return {'日期': label(d), '今天': today(),
            '今天栏_待做': [brief(t, on) for t in sched],
            '今天栏_已完成': [brief(t, on) for t in fin],
            '当天完成但计划日不是这天（不在今天栏）': [brief(t, on) for t in other_done],
            '当天其他进展': [brief(t, on) for t in prog],
            '当天交付截止': [brief(t) for t in dl]}

def get_week(day=None):
    data = load(); d = need_day(day); s = monday(d); e = shift(s, 6); cur = monday(today())
    T = data['tasks']; inw = lambda x: bool(x) and s <= x <= e
    dated = [t for t in T if inw(t.get('plan')) or (s == cur and not t['done'] and t.get('plan') and t['plan'] < s)]
    dated.sort(key=lambda t: ((t['done'], not t.get('urgent')) if s == cur else (0, 0), t.get('plan') or '9999', t['id']))
    pending = [t for t in T if not t['done'] and not t.get('plan') and t.get('week') == s]
    done = [t for t in T if t['done'] and inw(actual_day(t))]
    prog = [t for t in T if any(inw(ev['day']) for ev in t.get('events') or [])]
    dl = [t for t in T if inw(t.get('deadline')) and not t['done']]
    return {'周': f'{label(s)} ~ {label(e)}', '今天': today(),
            '本周排期': [brief(t, inw) | ({'延后未完成': True} if t.get('plan') and t['plan'] < s else {}) for t in dated],
            '本周待安排（未定日期）': [brief(t, inw) for t in pending],
            '本周已完成': [brief(t) for t in done],
            '本周有进展的任务': [brief(t, inw) for t in prog],
            '本周交付截止': [brief(t) for t in dl]}

def list_tasks(month=None, keyword=None, status='全部', plan_from=None, plan_to=None, include_hidden=False, limit=50):
    data = load(); out = []
    if month and not re.fullmatch(r'\d{4}(-\d{2})?', month): raise ValueError('月份格式 YYYY-MM 或年份 YYYY')
    for t in data['tasks']:
        if t.get('hidden') and not include_hidden: continue
        if month and not (t.get('month') or '').startswith(month): continue
        if status in ('未完成', 'open') and t['done']: continue
        if status in ('已完成', 'done') and not t['done']: continue
        if plan_from and not (t.get('plan') and t['plan'] >= plan_from): continue
        if plan_to and not (t.get('plan') and t['plan'] <= plan_to): continue
        if keyword:
            hay = ' '.join(str(t.get(k) or '') for k in ('title', 'note', 'next', 'dateText', 'requirements')) + ' '.join(e['text'] for e in t.get('events') or [])
            if keyword.lower() not in hay.lower(): continue
        out.append(t)
    out.sort(key=lambda t: (t.get('sortDay') or t.get('plan') or t.get('month') or '', t['id']))
    total = len(out); limit = max(1, min(int(limit or 50), 400))
    return {'共': total, '显示': min(total, limit), '任务': [brief(t) for t in out[:limit]]}

def get_task(task):
    data = load(); t = find_task(data, task)
    r = {k: v for k, v in t.items() if k not in ('src', 'initial')}
    return r

# ── 写：修改函数（作用在 data 上，返回说明） ──
def _event(data, t, day, text, done):
    seq = max([e['seq'] for x in data['tasks'] for e in x.get('events') or []] + [0]) + 1
    ev = {'seq': seq, 'day': day, 'text': text.strip(), 'done': bool(done)}
    t.setdefault('events', []).append(ev); return ev

def m_add_progress(data, task, text, day=None, done=False):
    if not (text or '').strip(): raise ValueError('进展内容不能为空')
    t = find_task(data, task); d = need_day(day)
    ev = _event(data, t, d, text, done)
    if done:
        t['done'] = True; t['completed'] = d
    return t, f"已给「{t['title']}」记 {d} 进展（第 {ev['seq']} 条）" + ('，并标记完成' if done else '')

def m_mark_done(data, task, day=None, text=None):
    t = find_task(data, task); d = need_day(day)
    if t['done'] and t.get('completed') == d and not text: raise ValueError(f"「{t['title']}」已在 {d} 标记完成")
    t['done'] = True; t['completed'] = d
    _event(data, t, d, text or f"{cn(d)}{t['title']}已完成。", True)
    msg = f"已标记「{t['title']}」完成（完成日 {d}）"
    if t.get('plan') != d: msg += f"；注意计划日是 {t.get('plan') or '未定'}，所以不会出现在 {d} 的今天栏，会出现在本周已完成"
    return t, msg

def m_add_task(data, title, plan=None, deadline=None, note=None, next_step=None, date_text=None, month=None, urgent=False, src=None, requirements=None):
    title = (title or '').strip()
    if not title: raise ValueError('请填写任务名称')
    td = today()
    if plan: plan = need_day(plan, '计划日')
    if deadline: deadline = need_day(deadline, '交付日')
    if month and not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', month): raise ValueError('月份格式 YYYY-MM')
    yr = td[:4]; ids = [t['id'] for t in data['tasks'] if str(t['id']).startswith(yr)]
    nid = (max(ids) + 1) if ids else int(yr + '0001')
    if any(t['id'] == nid for t in data['tasks']): raise ValueError('编号冲突')
    t = {'id': nid, 'title': title, 'month': month or (plan or td)[:7], 'hidden': False,
         'dateText': (date_text or '').strip() or cn(plan or td), 'done': False, 'note': (note or '').strip(),
         'plan': plan, 'week': monday(plan or td), 'originalPlan': None, 'deadline': deadline,
         'next': (next_step or '').strip() or None, 'monthNotes': [], 'stages': None, 'shoot': None, 'initial': None,
         'events': [], 'history': [], 'urgent': bool(urgent), 'src': src or 'Ke口述（连接器）',
         'recordDay': td, 'sortDay': deadline or plan or td, 'handover': None,
         'requirements': clean_requirements(requirements) if requirements is not None else None}
    data['tasks'].append(t)
    if t['note']: _event(data, t, td, f"{cn(td)}新增：{t['note']}", False)
    return t, f"已新增任务 {nid}「{title}」" + (f"，排在 {plan}" if plan else '，未定日期（放进本周待安排）')

def m_reschedule(data, task, new_plan, reason=None, date_text=None):
    t = find_task(data, task); np_ = need_day(new_plan, '新计划日')
    old = t.get('plan')
    if old == np_: raise ValueError(f"「{t['title']}」本来就排在 {np_}")
    if t.get('originalPlan') is None and old: t['originalPlan'] = old
    t['plan'] = np_; t['week'] = monday(np_)
    if t.get('sortDay') == old or not t.get('deadline'): t['sortDay'] = t.get('deadline') or np_
    if date_text: t['dateText'] = date_text.strip()
    if reason: _event(data, t, today(), f"{cn(today())}改期：{old or '未定'} → {np_}。{reason.strip()}", False)
    return t, f"已把「{t['title']}」从 {old or '未定'} 改到 {np_}（原计划保留为 {t.get('originalPlan') or '无'}）"

def m_update_note(data, task, note=None, next_step=None, deadline=None, date_text=None, title=None, urgent=None, requirements=None):
    t = find_task(data, task); ch = []
    if note is not None: t['note'] = note.strip(); ch.append('说明')
    if requirements is not None: t['requirements'] = clean_requirements(requirements); ch.append('具体制作要求')
    if next_step is not None: t['next'] = next_step.strip() or None; ch.append('下一步')
    if deadline is not None:
        t['deadline'] = need_day(deadline, '交付日') if deadline.strip() else None; ch.append('交付日')
    if date_text is not None: t['dateText'] = date_text.strip(); ch.append('日期文字')
    if title is not None and title.strip(): t['title'] = title.strip(); ch.append('标题')
    if urgent is not None: t['urgent'] = bool(urgent); ch.append('急')
    if not ch: raise ValueError('没有要改的内容')
    return t, f"已更新「{t['title']}」的" + '、'.join(ch)

# ── 流水线 ──
def _run(cmd, cwd=None, timeout=300):
    p = subprocess.run(cmd, cwd=cwd, env=ENV, capture_output=True, text=True, timeout=timeout)
    return p.returncode, (p.stdout + p.stderr)[-3000:]

def sha1(path):
    with open(path, 'rb') as f: return hashlib.sha1(f.read()).hexdigest()

def online_sha():
    req = urllib.request.Request(PAGES + '?t=' + str(time.time_ns()), headers={'Cache-Control': 'no-cache', 'User-Agent': 'langui-mcp'})
    with urllib.request.urlopen(req, timeout=20) as r: return hashlib.sha1(r.read()).hexdigest()

def wait_online(want, seconds):
    end = time.time() + seconds
    while True:
        try:
            if online_sha() == want: return True
        except Exception: pass
        if time.time() > end: return False
        time.sleep(8)

def publish(msg):
    """推送当前 HTML 到 GitHub Pages；返回 (commit 是否有变化, 本地 sha)。"""
    want = sha1(HTML); tmp = tempfile.mkdtemp(prefix='lg-pub-')
    try:
        rc, out = _run(['gh', 'repo', 'clone', REPO, tmp + '/r', '--', '-q', '--depth', '1'], timeout=120)
        if rc: raise RuntimeError('克隆仓库失败：' + out)
        shutil.copyfile(HTML, tmp + '/r/index.html')
        rc, out = _run(['git', 'status', '--porcelain'], cwd=tmp + '/r')
        if not out.strip(): return False, want
        g = ['git', '-c', 'user.name=' + GIT_NAME, '-c', 'user.email=' + GIT_EMAIL]
        for c in (['git', 'add', 'index.html'], g + ['commit', '-q', '-m', msg], ['git', 'push', '-q', 'origin', 'HEAD']):
            rc, out = _run(c, cwd=tmp + '/r', timeout=120)
            if rc: raise RuntimeError('推送失败：' + out)
        return True, want
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def backup_store():
    if STORE_BACKUP:
        os.makedirs(os.path.dirname(STORE_BACKUP), exist_ok=True)
        tmp = STORE_BACKUP + '.tmp'; shutil.copyfile(DATA, tmp); os.replace(tmp, STORE_BACKUP)

def _write_atomic(path, content):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: f.write(content)
    os.replace(tmp, path)

def mutate(fn, *a, **kw):
    """备份 → 修改 → build → 测试（失败回滚）→ 推送 → 核对线上 → 备份到 store。串行加锁。"""
    with _tlock, open(LOCK, 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        old_data = open(DATA, encoding='utf-8').read(); old_html = open(HTML, 'rb').read()
        os.makedirs(BACKUP_DIR, exist_ok=True)
        stamp = datetime.datetime.now(TZ).strftime('%Y%m%d-%H%M%S')
        bak = f'{BACKUP_DIR}/data-{stamp}.json'; _write_atomic(bak, old_data)
        for f in sorted(os.listdir(BACKUP_DIR))[:-60]: os.remove(os.path.join(BACKUP_DIR, f))  # 只留最近 60 份
        data = json.loads(old_data); before = copy.deepcopy(data)
        task, msg = fn(data, *a, **kw)
        if data == before: return {'ok': True, '结果': msg + '（数据没有变化）'}
        def rollback():
            _write_atomic(DATA, old_data)
            with open(HTML, 'wb') as f: f.write(old_html)
        try:
            _write_atomic(DATA, dump(data))
            rc, out = _run(['python3', BUILD], timeout=180)
            if rc: raise RuntimeError('生成网页失败：' + out)
            for t in TESTS:
                rc, out = _run(['node', t], cwd=os.path.dirname(t), timeout=300)
                if rc: raise RuntimeError(f'测试 {os.path.basename(t)} 没通过：' + out)
        except Exception as e:
            rollback(); raise RuntimeError(f'{e}\n已回滚，数据没有改动。') from None
        res = {'ok': True, '结果': msg, '任务': brief(task, lambda d: True)}
        if PUBLISH:
            try:
                changed, want = publish(f'{today()[5:].replace("-", "/")} {msg}'[:120])
            except Exception as e:
                rollback(); raise RuntimeError(f'{e}\n已回滚本地数据，线上未改动。') from None
            ok = wait_online(want, int(os.environ.get('LANGUI_WAIT', '35')))
            res['线上'] = ('已更新并核对一致：' if ok else '已推送，GitHub Pages 还在部署（通常 1–3 分钟），稍后用 check_online 核对：') + PAGES
        else:
            res['线上'] = '测试模式：未推送'
        try:
            if STORE_BACKUP: backup_store(); res['备份'] = '已备份到 store'
        except Exception as e: res['备份'] = f'store 备份失败：{e}'
        return res

def check_online():
    want = sha1(HTML)
    try: got = online_sha()
    except Exception as e: return {'一致': False, '错误': str(e)}
    return {'一致': got == want, '本地sha1': want, '线上sha1': got, '网址': PAGES}
