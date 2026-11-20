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


def this_projects():
    return [{'name': '虚构星河纪录', 'track': 'general', 'lines': [
        {'emoji': '✅', 'process': '文案', 'status': '已定稿', 'text': THIS_COPY, 'aspect': '9:16'},
        {'emoji': '🎬', 'process': '横版', 'status': '粗剪', 'text': THIS_LAND},
        {'emoji': '📱', 'process': '竖版', 'status': '进行中', 'text': THIS_PORT},
        {'emoji': '🎧', 'process': '配音', 'status': '已录', 'text': '虚构甲周旁白句子'},
    ]}]


def this_followups():
    return [{'name': '虚构星河纪录', 'lines': [
        {'emoji': '📌', 'process': '配音', 'status': '待补', 'text': FOLLOW},
    ]}]


def cross_projects():
    return [{'name': '虚构教室短片', 'track': 'education', 'lines': [
        {'emoji': '📝', 'process': '脚本', 'status': '讨论中', 'text': CROSS_COPY},
        {'emoji': '🎬', 'process': '横版', 'status': '未开始', 'text': CROSS_LAND, 'aspect': '9:16'},
        {'emoji': '🏁', 'process': '片尾', 'status': '待做', 'text': '虚构跨年片尾句子'},
    ]}]


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
        self.assertEqual(data['weeklyReports'][0]['projects'][0]['lines'][1]['aspect'], '16:9')
        self.assertNotIn('aspect', data['weeklyReports'][0]['projects'][0]['lines'][0])
        second, again = store.m_save_weekly_report(data, '2026-01-01', json.dumps(cross_projects(), ensure_ascii=False), '[]')
        self.assertIn('未重复创建', again)
        self.assertEqual(len(data['weeklyReports']), 1)
        self.assertEqual(second['report']['更新'], first['report']['更新'])
        store.m_save_weekly_report(data, '2026-11-18', this_projects(), this_followups())
        self.assertEqual([row['week'] for row in data['weeklyReports']], ['2025-12-29', '2026-11-16'])
        cross_stamp = data['weeklyReports'][0]['updatedAt']
        self.assertEqual(data['weeklyReports'][0]['projects'][0]['lines'][0]['text'], CROSS_COPY)
        self.assertEqual(data['weeklyReports'][0]['projects'][0]['lines'][0]['status'], '讨论中')
        updated, _ = store.m_save_weekly_report(data, '2026-11-20', this_projects(), [{
            'name': '虚构星河纪录',
            'lines': [{'emoji': '📌', 'process': '字幕', 'status': '待校', 'text': '虚构甲周后续字幕句子'}],
        }])
        self.assertEqual(len(data['weeklyReports']), 2)
        self.assertEqual(updated['report']['后续工作跟进'][0]['lines'][0]['process'], '字幕')
        self.assertEqual(data['weeklyReports'][0]['projects'][0]['lines'][0]['text'], CROSS_COPY)
        self.assertEqual(data['weeklyReports'][0]['updatedAt'], cross_stamp)
        self.assertEqual(data['tasks'], tasks)
        self.assertEqual(data['social'], social)
        self.assertEqual(data['platforms'], platforms)
        self.assertEqual((ROOT / 'build' / 'data.json').read_text(encoding='utf-8'), disk)
        self.assertNotIn('id', data['weeklyReports'][1])
        line = data['weeklyReports'][1]['projects'][0]['lines'][0]
        self.assertEqual(line['text'], THIS_COPY)
        self.assertNotIn('aspect', line)
        self.assertEqual(data['weeklyReports'][1]['projects'][0]['lines'][1]['aspect'], '16:9')
        self.assertEqual(data['weeklyReports'][1]['projects'][0]['lines'][2]['aspect'], '9:16')
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
        self.assertEqual(got['项目'][0]['lines'][0]['text'], CROSS_COPY)
        self.assertEqual(got['项目'][0]['lines'][1]['aspect'], '16:9')
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

    def test_rejects_bad_shape_without_touching_tasks(self):
        data = copy.deepcopy(BASE)
        before = copy.deepcopy(data)
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '', this_projects(), [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构普通项目', 'lines': [
                {'emoji': '📝', 'process': '脚本', 'text': '普通项目不能用脚本'}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构重复', 'lines': [
                {'emoji': '✅', 'process': '文案', 'text': '甲'},
                {'emoji': '✅', 'process': '文案', 'text': '乙'}]}], [])
        with self.assertRaises(ValueError):
            store.m_save_weekly_report(data, '2026-11-16', [{'name': '虚构标记', 'lines': [
                {'emoji': '<b>', 'process': '文案', 'text': '不行'}]}], [])
        self.assertEqual(data, before)
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
