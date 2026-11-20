"""合成周报：跨年周一、幂等保存、空态、旧库往返。不读取、不修改真实 data.json，不调用 mutate，不发布。"""
import copy, json, os, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(tempfile.mkdtemp(prefix='lg-week-'))
(ROOT / 'build').mkdir()
(ROOT / 'restore' / 'src').mkdir(parents=True)
REQ = '虚构要求\n第二行 <b>不是标签</b>'
NASTY = '第一行\n第二行 <b>不是标签</b> &</script>'
THIS_COPY = '虚构甲周文案句子'
THIS_LAND = '虚构甲周横版句子'
THIS_PORT = '虚构甲周竖版句子'
FOLLOW = '虚构甲周后续配音句子'
CROSS_COPY = '虚构跨年脚本句子'
CROSS_LAND = '虚构跨年横版句子'
BASE = {
    'version': 'synthetic',
    'tasks': [
        {
            'id': 20260001, 'title': '虚构任务甲', 'month': '2026-11', 'hidden': False,
            'dateText': '11月16日', 'done': False, 'note': '虚构任务进度', 'plan': '2026-11-16',
            'week': '2026-11-16', 'originalPlan': None, 'deadline': None, 'next': '虚构下一步',
            'monthNotes': [], 'stages': None, 'shoot': None, 'initial': '不应返回',
            'events': [{'seq': 1, 'day': '2026-11-16', 'text': '虚构任务进展句子', 'done': False}],
            'history': [], 'urgent': False, 'src': 'synthetic', 'recordDay': '2026-11-16',
            'sortDay': '2026-11-16', 'handover': None, 'requirements': REQ,
        },
        {
            'id': 20250001, 'title': '虚构旧档', 'month': '2025-12', 'hidden': False,
            'dateText': '12月1日', 'done': True, 'note': '旧进度', 'plan': '2025-12-01',
            'week': '2025-12-01', 'originalPlan': None, 'deadline': None, 'next': None,
            'monthNotes': [], 'stages': None, 'shoot': None, 'initial': '旧初始',
            'events': [], 'history': [], 'urgent': False, 'src': 'synthetic',
            'recordDay': '2025-12-01', 'sortDay': '2025-12-01', 'handover': None,
        },
    ],
    'social': [{'seq': 1, 'month': '2026-10', 'date': '2026-10-08', 'title': '虚构社媒', 'content': '虚构社媒正文', 'work': '虚构栏目'}],
    'platforms': ['synthetic'],
}
(ROOT / 'build' / 'data.json').write_text(json.dumps(BASE, ensure_ascii=False), encoding='utf-8')
os.environ['LANGUI_ROOT'] = str(ROOT)
os.environ['LANGUI_PUBLISH'] = '0'
os.environ['LANGUI_TODAY'] = '2026-11-18'
os.environ['LANGUI_STORE_BACKUP'] = ''
sys.path.insert(0, str(Path(__file__).resolve().parent))
import store


def row(emoji, label, text, status=None, **extra):
    item = {'emoji': emoji, 'label': label, 'text': text}
    if status: item['status'] = status
    item.update(extra)
    return item


def block_line(project, block_type, label):
    for block in project['blocks']:
        if block['type'] != block_type: continue
        for line in block['lines']:
            if line['label'] == label: return line
    raise AssertionError(f'{block_type}/{label}')


def this_projects():
    return [
        {
            'name': '虚构星河纪录', 'emoji': '🎬', 'status': '进行中', 'track': 'general',
            'blocks': [
                {'type': '制作', 'lines': [
                    row('✅', '文案', THIS_COPY, '已定稿', aspect='9:16'),
                    row('🎧', '配音', '虚构甲周配音句子', '已录'),
                    row('🗂️', '素材', '虚构甲周素材句子'),
                    row('🎞️', '片头', '虚构甲周片头句子'),
                    row('💬', '字幕', '虚构甲周字幕句子'),
                    row('🎬', '横版', THIS_LAND, '粗剪'),
                    row('📱', '竖版', THIS_PORT, '进行中'),
                ]},
                {'type': '逐日进展', 'lines': [
                    row('📅', '周一', '虚构周一进展句子'),
                    row('📅', '周二', '虚构周二进展句子'),
                    row('📅', '周三', '虚构周三进展句子'),
                    row('✂️', '剪辑', '虚构逐日剪辑句子'),
                    row('📦', '交片', '虚构逐日交片句子'),
                ]},
                {'type': '会议', 'lines': [
                    row('✅', '周二上午', '2026-11-17 虚构已参加会议句子', attendance='已参加'),
                    row('📌', '会议', '2026-11-24 虚构待参加会议句子', '待定', attendance='待参加'),
                ]},
            ],
        },
        {
            'name': '虚构教室短片', 'emoji': '✅', 'status': '完成', 'track': 'education',
            'blocks': [
                {'type': '制作', 'lines': [
                    row('📝', '脚本', '虚构教室脚本句子', '讨论中'),
                    row('🏁', '片尾', '虚构教室片尾句子'),
                    row('🎬', '横版', '虚构教室横版句子', aspect='9:16'),
                ]},
            ],
        },
    ]


def this_followups():
    labels = {
        '时间': '2026-11-25 09:00', '到场': '虚构到场句子', '地点': '虚构地点句子', '人员': '虚构人员句子',
        '工作': '虚构跟进工作句子', '拍摄': '虚构拍摄句子', '内容': '虚构跟进内容句子', '素材截止': '2026-11-27',
        '后续': FOLLOW, '交片': '虚构跟进交片句子',
    }
    return [{
        'name': '虚构外拍安排', 'emoji': '📌', 'status': '待办',
        'blocks': [{'type': '拍摄/交付跟进', 'lines': [row('📍', label, text) for label, text in labels.items()]}],
    }]


def cross_projects():
    return [{
        'name': '虚构跨年短片', 'emoji': '🎬', 'status': '进行中', 'track': 'education',
        'blocks': [{'type': '制作', 'lines': [
            row('📝', '脚本', CROSS_COPY, '讨论中'),
            row('🎬', '横版', CROSS_LAND, '未开始', aspect='9:16'),
        ]}],
    }]


class WeeklyReportStoreTest(unittest.TestCase):
    def test_monday_cross_year_and_pipeline_gate_unchanged(self):
        self.assertEqual(store.explicit_monday('2026-01-01'), '2025-12-29')
        self.assertEqual(store.explicit_monday('2026-01-04'), '2025-12-29')
        self.assertEqual(store.explicit_monday('2026-01-05'), '2026-01-05')
        self.assertEqual(store.explicit_monday('2025-01-01'), '2024-12-30')
        self.assertEqual([os.path.basename(path) for path in store.TESTS], ['flow.test.js', 'migrate.test.js'])
        server = Path(__file__).with_name('server.py').read_text(encoding='utf-8')
        for name in ('save_weekly_report', 'get_weekly_report', 'list_weekly_reports'):
            self.assertIn(f'async def {name}', server)
        self.assertIn("mcp.run('stdio')", server)
        for token in ('逐日进展', '周二上午', '拍摄/交付跟进', '已参加', '待参加', '素材截止'):
            self.assertIn(token, server)
        self.assertNotIn('weekly-report.test.js', store.TESTS.__repr__())

    def test_old_data_roundtrip_and_empty_week_is_not_another_week(self):
        (ROOT / 'build' / 'data.json').write_text(json.dumps(BASE, ensure_ascii=False), encoding='utf-8')
        raw = json.loads((ROOT / 'build' / 'data.json').read_text(encoding='utf-8'))
        self.assertNotIn('weeklyReports', raw)
        self.assertNotIn('requirements', raw['tasks'][1])
        data = copy.deepcopy(BASE)
        store.m_update_note(data, 20260001, note='只改进度')
        self.assertNotIn('weeklyReports', data)
        self.assertEqual(data['tasks'][0]['requirements'], REQ)
        self.assertEqual(data['tasks'][0]['events'][0]['text'], '虚构任务进展句子')
        again = json.loads(store.dump(data))
        self.assertNotIn('weeklyReports', again)
        self.assertEqual(again['social'], BASE['social'])
        self.assertEqual(again['platforms'], BASE['platforms'])
        self.assertNotIn('requirements', again['tasks'][1])
        missing = store.get_weekly_report('2026-01-02')
        self.assertFalse(missing['有记录'])
        self.assertEqual(missing['周一'], '2025-12-29')
        self.assertEqual(missing['周日'], '2026-01-04')
        self.assertEqual(missing['时区'], 'Asia/Shanghai')
        self.assertEqual(missing['项目'], [])
        self.assertNotIn(THIS_COPY, json.dumps(missing, ensure_ascii=False))
        self.assertEqual(store.list_weekly_reports()['周报'], [])
        current = store.get_weekly_report(None)
        self.assertEqual(current['周一'], '2026-11-16')
        self.assertFalse(current['有记录'])

    def test_save_is_idempotent_keeps_other_weeks_and_tasks(self):
        data = copy.deepcopy(BASE)
        tasks, social, platforms = copy.deepcopy(data['tasks']), copy.deepcopy(data['social']), copy.deepcopy(data['platforms'])
        disk = (ROOT / 'build' / 'data.json').read_text(encoding='utf-8')
        first, msg = store.m_save_weekly_report(data, '2026-01-03', cross_projects(), [])
        self.assertEqual(first['kind'], 'weekly-report')
        self.assertIn('未写入任务', msg)
        self.assertEqual(first['report']['周一'], '2025-12-29')
        self.assertEqual(first['report']['周日'], '2026-01-04')
        cross = data['weeklyReports'][0]['projects'][0]
        self.assertEqual(cross['status'], '进行中')
        self.assertEqual(cross['emoji'], '🎬')
        self.assertNotIn('进行中', cross['name'])
        self.assertEqual(block_line(cross, '制作', '横版')['aspect'], '16:9')
        self.assertNotIn('aspect', block_line(cross, '制作', '脚本'))
        second, again = store.m_save_weekly_report(data, '2026-01-01', json.dumps(cross_projects(), ensure_ascii=False), '[]')
        self.assertIn('未重复创建', again)
        self.assertEqual(len(data['weeklyReports']), 1)
        self.assertEqual(second['report']['更新'], first['report']['更新'])
        store.m_save_weekly_report(data, '2026-11-18', this_projects(), this_followups())
        self.assertEqual([row['week'] for row in data['weeklyReports']], ['2025-12-29', '2026-11-16'])
        cross_stamp = data['weeklyReports'][0]['updatedAt']
        self.assertEqual(block_line(data['weeklyReports'][0]['projects'][0], '制作', '脚本')['text'], CROSS_COPY)
        self.assertEqual(block_line(data['weeklyReports'][0]['projects'][0], '制作', '脚本')['status'], '讨论中')
        changed = this_followups()
        changed[0]['blocks'][0]['lines'][0]['text'] = '2026-11-26 10:00'
        updated, _ = store.m_save_weekly_report(data, '2026-11-20', this_projects(), changed)
        self.assertEqual(len(data['weeklyReports']), 2)
        saved_follow = updated['report']['后续工作跟进'][0]
        self.assertEqual(saved_follow['blocks'][0]['lines'][0]['label'], '时间')
        self.assertEqual(saved_follow['blocks'][0]['lines'][0]['text'], '2026-11-26 10:00')
        self.assertEqual(block_line(data['weeklyReports'][0]['projects'][0], '制作', '脚本')['text'], CROSS_COPY)
        self.assertEqual(data['weeklyReports'][0]['updatedAt'], cross_stamp)
        self.assertEqual(data['tasks'], tasks)
        self.assertEqual(data['social'], social)
        self.assertEqual(data['platforms'], platforms)
        self.assertEqual((ROOT / 'build' / 'data.json').read_text(encoding='utf-8'), disk)
        self.assertNotIn('id', data['weeklyReports'][1])
        current = data['weeklyReports'][1]['projects'][0]
        self.assertEqual(current['name'], '虚构星河纪录')
        self.assertEqual(current['emoji'], '🎬')
        self.assertEqual(current['status'], '进行中')
        self.assertNotIn('进行中', current['name'])
        copy_line = block_line(current, '制作', '文案')
        self.assertEqual(copy_line['text'], THIS_COPY)
        self.assertNotIn('aspect', copy_line)
        self.assertEqual(block_line(current, '制作', '横版')['aspect'], '16:9')
        self.assertEqual(block_line(current, '制作', '竖版')['aspect'], '9:16')
        self.assertEqual(block_line(current, '逐日进展', '交片')['text'], '虚构逐日交片句子')
        self.assertEqual(block_line(current, '会议', '周二上午')['attendance'], '已参加')
        self.assertEqual(block_line(current, '会议', '会议')['attendance'], '待参加')
        school = data['weeklyReports'][1]['projects'][1]
        self.assertEqual(school['status'], '完成')
        self.assertEqual(block_line(school, '制作', '脚本')['text'], '虚构教室脚本句子')
        follow = data['weeklyReports'][1]['followups'][0]
        self.assertEqual(follow['status'], '待办')
        self.assertEqual([item['label'] for item in follow['blocks'][0]['lines']], list(changed[0]['blocks'][0]['lines'] and ['时间', '到场', '地点', '人员', '工作', '拍摄', '内容', '素材截止', '后续', '交片']))
        self.assertEqual(block_line(follow, '拍摄/交付跟进', '交片')['text'], '虚构跟进交片句子')
        self.assertNotEqual(block_line(current, '逐日进展', '交片')['text'], block_line(follow, '拍摄/交付跟进', '交片')['text'])
        self.assertTrue(data['weeklyReports'][1]['updatedAt'].endswith('+08:00'))
        self.assertEqual(data['weeklyReports'][1]['timezone'], 'Asia/Shanghai')

    def test_reads_match_saved_week_and_new_task_keeps_reports(self):
        data = copy.deepcopy(BASE)
        store.m_save_weekly_report(data, '2025-12-31', cross_projects(), [])
        store.m_save_weekly_report(data, '2026-11-16', this_projects(), this_followups())
        reports = copy.deepcopy(data['weeklyReports'])
        (ROOT / 'build' / 'data.json').write_text(store.dump(data), encoding='utf-8')
        got = store.get_weekly_report('2026-01-02')
        self.assertTrue(got['有记录'])
        self.assertEqual(got['周一'], '2025-12-29')
        self.assertEqual(block_line(got['项目'][0], '制作', '脚本')['text'], CROSS_COPY)
        self.assertEqual(block_line(got['项目'][0], '制作', '横版')['aspect'], '16:9')
        self.assertNotIn(THIS_COPY, json.dumps(got, ensure_ascii=False))
        empty = store.get_weekly_report('2026-11-12')
        self.assertFalse(empty['有记录'])
        self.assertEqual(empty['周一'], '2026-11-09')
        self.assertEqual(empty['项目'], [])
        self.assertNotIn(THIS_COPY, json.dumps(empty, ensure_ascii=False))
        self.assertNotIn(CROSS_COPY, json.dumps(empty, ensure_ascii=False))
        listed = store.list_weekly_reports()['周报']
        self.assertEqual([item['周'] for item in listed], ['2025-12-29', '2026-11-16'])
        self.assertFalse(store.list_tasks(keyword=THIS_COPY)['任务'])
        store.m_add_task(data, '虚构新任务', plan='2026-11-18', note='虚构新进度')
        store.m_add_progress(data, 20260001, '虚构追加进展', '2026-11-18', False)
        self.assertEqual(data['weeklyReports'], reports)
        blob = json.dumps(data['tasks'], ensure_ascii=False)
        self.assertNotIn(THIS_COPY, blob)
        self.assertNotIn(CROSS_COPY, blob)
        self.assertEqual(data['tasks'][0]['requirements'], REQ)
        self.assertEqual(data['tasks'][0]['events'][-1]['text'], '虚构追加进展')
        (ROOT / 'build' / 'data.json').write_text(json.dumps(BASE, ensure_ascii=False), encoding='utf-8')
        created = data['tasks'][-1]
        self.assertNotIn('weeklyReports', created)
        self.assertEqual(created['note'], '虚构新进度')

    def test_same_week_update_keeps_unknown_report_metadata(self):
        data = copy.deepcopy(BASE)
        store.m_save_weekly_report(data, '2026-11-16', this_projects(), this_followups())
        current = next(row for row in data['weeklyReports'] if row['week'] == '2026-11-16')
        current['marker'] = {'id': 'synthetic-keep'}
        current['note'] = '虚构元数据'
        stamp = current['updatedAt']
        _, again = store.m_save_weekly_report(data, '2026-11-18', this_projects(), this_followups())
        current = next(row for row in data['weeklyReports'] if row['week'] == '2026-11-16')
        self.assertIn('未重复创建', again)
        self.assertEqual(current['marker'], {'id': 'synthetic-keep'})
        self.assertEqual(current['note'], '虚构元数据')
        self.assertEqual(current['updatedAt'], stamp)
        changed = this_followups()
        changed[0]['blocks'][0]['lines'][0]['text'] = '2026-11-26 10:00'
        store.m_save_weekly_report(data, '2026-11-20', this_projects(), changed)
        current = next(row for row in data['weeklyReports'] if row['week'] == '2026-11-16')
        self.assertEqual(current['marker'], {'id': 'synthetic-keep'})
        self.assertEqual(current['note'], '虚构元数据')
        self.assertEqual(current['timezone'], 'Asia/Shanghai')
        self.assertEqual(block_line(current['followups'][0], '拍摄/交付跟进', '时间')['text'], '2026-11-26 10:00')
        self.assertEqual(current['projects'][0]['name'], '虚构星河纪录')
        self.assertNotIn('marker', current['projects'][0])
        store.m_save_weekly_report(data, '2025-12-29', cross_projects(), [])
        cross = next(row for row in data['weeklyReports'] if row['week'] == '2025-12-29')
        self.assertNotIn('marker', cross)
        self.assertEqual(next(row for row in data['weeklyReports'] if row['week'] == '2026-11-16')['marker']['id'], 'synthetic-keep')

    def test_followups_keep_pending_meetings_and_leave_history(self):
        data = copy.deepcopy(BASE)
        tasks = copy.deepcopy(data['tasks'])
        store.m_save_weekly_report(data, '2025-12-29', cross_projects(), [])
        cross_before = copy.deepcopy(next(row for row in data['weeklyReports'] if row['week'] == '2025-12-29'))
        pending = '2026-11-25 虚构后续待参加会议句子'
        follow = this_followups()
        follow[0]['blocks'].append({'type': '会议', 'lines': [
            row('📌', '周三上午', pending, attendance='待参加'),
        ]})
        store.m_save_weekly_report(data, '2026-11-16', this_projects(), follow)
        current = next(row for row in data['weeklyReports'] if row['week'] == '2026-11-16')
        saved = block_line(current['followups'][0], '会议', '周三上午')
        self.assertEqual(saved['attendance'], '待参加')
        self.assertEqual(saved['text'], pending)
        self.assertNotIn(pending, json.dumps(current['projects'], ensure_ascii=False))
        self.assertEqual(next(row for row in data['weeklyReports'] if row['week'] == '2025-12-29'), cross_before)
        self.assertEqual(data['tasks'], tasks)
        attended = copy.deepcopy(follow)
        attended[0]['blocks'][-1]['lines'][0]['attendance'] = '已参加'
        attended[0]['blocks'][-1]['lines'][0]['text'] = '2026-11-18 虚构已开完的会'
        with self.assertRaises(ValueError) as ctx:
            store.m_save_weekly_report(copy.deepcopy(BASE), '2026-11-16', this_projects(), attended)
        self.assertIn('待参加', str(ctx.exception))
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(copy.deepcopy(BASE), '2026-11-16', this_projects(), [{
                'name': '虚构不该进后续', 'emoji': '🎬', 'status': '进行中',
                'blocks': [{'type': '制作', 'lines': [{'emoji': '✅', 'label': '文案', 'text': '虚构制作不进后续'}]}],
            }])
        nodate = copy.deepcopy(follow)
        nodate[0]['blocks'][-1]['lines'][0]['text'] = '下周再看'
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(copy.deepcopy(BASE), '2026-11-16', this_projects(), nodate)
        self.assertEqual(data['tasks'], tasks)
        self.assertEqual(next(row for row in data['weeklyReports'] if row['week'] == '2025-12-29'), cross_before)

    def test_rejects_bad_shape_without_touching_tasks(self):
        data = copy.deepcopy(BASE)
        before = copy.deepcopy(data)
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '', this_projects(), [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构普通项目', 'emoji': '🎬', 'status': '进行中', 'blocks': [
                {'type': '制作', 'lines': [{'emoji': '📝', 'label': '脚本', 'text': '普通项目不能用脚本'}]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构错块', 'emoji': '🎬', 'status': '进行中', 'blocks': [
                {'type': '制作', 'lines': [{'emoji': '📅', 'label': '周一', 'text': '不能放进制作'}]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构重复', 'emoji': '🎬', 'status': '进行中', 'blocks': [
                {'type': '制作', 'lines': [
                    {'emoji': '✅', 'label': '文案', 'text': '甲'},
                    {'emoji': '✅', 'label': '文案', 'text': '乙'},
                ]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构标记', 'emoji': '<b>', 'status': '进行中', 'blocks': [
                {'type': '制作', 'lines': [{'emoji': '✅', 'label': '文案', 'text': '不行'}]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构无状态', 'emoji': '🎬', 'blocks': [
                {'type': '制作', 'lines': [{'emoji': '✅', 'label': '文案', 'text': '状态被写进了名称'}]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构无日期会议', 'emoji': '🗓', 'status': '进行中', 'blocks': [
                {'type': '会议', 'lines': [{'emoji': '📌', 'label': '会议', 'attendance': '待参加', 'text': '下周再议'}]}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [], [{
                'name': '虚构跟进错标签', 'emoji': '📌', 'status': '待办',
                'blocks': [{'type': '拍摄/交付跟进', 'lines': [{'emoji': '✅', 'label': '文案', 'text': '跟进不能改称文案'}]}],
            }])
        self.assertEqual(data, before)
        meetings = copy.deepcopy(BASE)
        store.m_save_weekly_report(meetings, '2026-11-16', [{
            'name': '虚构双会议', 'emoji': '🗓', 'status': '进行中',
            'blocks': [{'type': '会议', 'lines': [
                {'emoji': '✅', 'label': '会议', 'attendance': '已参加', 'text': '2026-11-17 虚构一场'},
                {'emoji': '📌', 'label': '会议', 'attendance': '待参加', 'text': '11月24日 虚构另一场'},
            ]}],
        }], [])
        kept = meetings['weeklyReports'][0]['projects'][0]['blocks'][0]['lines']
        self.assertEqual([item['label'] for item in kept], ['会议', '会议'])
        self.assertEqual([item['attendance'] for item in kept], ['已参加', '待参加'])
        self.assertNotEqual(kept[0]['text'], kept[1]['text'])
        payload = {'kind': 'weekly-report', 'report': {'周一': '2026-11-16'}}
        saved = store._write_result(payload, '已保存周报', True)
        self.assertNotIn('任务', saved)
        self.assertEqual(saved['周报']['周一'], '2026-11-16')
        unchanged = store._write_result(payload, '已保存周报', False)
        self.assertIn('数据没有变化', unchanged['结果'])
        task_result = store._write_result(data['tasks'][0], '已更新说明', True)
        self.assertEqual(task_result['任务']['标题'], '虚构任务甲')
        self.assertNotIn('周报', task_result)
        self.assertNotIn('任务', store._write_result(data['tasks'][0], '已更新说明', False))


if __name__ == '__main__':
    unittest.main(verbosity=2)
