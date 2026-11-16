"""合成数据测试连接器读写。不读取、不修改真实 data.json，不调用 mutate，不发布。"""
import copy, json, os, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(tempfile.mkdtemp(prefix='lg-store-'))
(ROOT / 'build').mkdir()
(ROOT / 'restore' / 'src').mkdir(parents=True)
REQ = '第一行\n第二行 <b>不是标签</b> 中文「要求」&</script>'
BASE = {
    'version': 'synthetic',
    'tasks': [
        {
            'id': 20260001, 'title': '合成甲', 'month': '2026-11', 'hidden': False,
            'dateText': '11月16日', 'done': False, 'note': '进度甲', 'plan': '2026-11-16',
            'week': '2026-11-16', 'originalPlan': None, 'deadline': None, 'next': '下一步甲',
            'monthNotes': [], 'stages': None, 'shoot': None, 'initial': '不应返回',
            'events': [{'seq': 1, 'day': '2026-11-13', 'text': '进展甲', 'done': False}],
            'history': [], 'urgent': False, 'src': 'synthetic', 'recordDay': '2026-11-16',
            'sortDay': '2026-11-16', 'handover': None, 'requirements': REQ,
        },
        {
            'id': 20250001, 'title': '合成旧档', 'month': '2025-12', 'hidden': False,
            'dateText': '12月1日', 'done': True, 'note': '旧进度', 'plan': '2025-12-01',
            'week': '2025-12-01', 'originalPlan': None, 'deadline': None, 'next': None,
            'monthNotes': [], 'stages': None, 'shoot': None, 'initial': '旧初始',
            'events': [], 'history': [], 'urgent': False, 'src': 'synthetic',
            'recordDay': '2025-12-01', 'sortDay': '2025-12-01', 'handover': None,
        },
    ],
    'social': [],
    'platforms': [],
}
(ROOT / 'build' / 'data.json').write_text(json.dumps(BASE, ensure_ascii=False), encoding='utf-8')
os.environ['LANGUI_ROOT'] = str(ROOT)
os.environ['LANGUI_PUBLISH'] = '0'
os.environ['LANGUI_TODAY'] = '2026-11-16'
os.environ['LANGUI_STORE_BACKUP'] = ''
sys.path.insert(0, str(Path(__file__).resolve().parent))
import store


def task(data, tid):
    return next(t for t in data['tasks'] if t['id'] == tid)


class RequirementsStoreTest(unittest.TestCase):
    def test_reads_do_not_invent_requirements_for_old_rows(self):
        old = store.get_task('20250001')
        self.assertNotIn('requirements', old)
        self.assertNotIn('src', old)
        self.assertNotIn('initial', old)
        self.assertEqual(old['note'], '旧进度')
        brief = store.list_tasks(keyword='旧进度')['任务']
        self.assertEqual(len(brief), 1)
        self.assertNotIn('具体制作要求', brief[0])
        self.assertEqual(brief[0]['说明'], '旧进度')

    def test_list_get_day_week_search_requirements_without_mixing_note(self):
        found = store.list_tasks(keyword='中文「要求」')['任务']
        self.assertEqual([t['id'] for t in found], [20260001])
        self.assertEqual(found[0]['具体制作要求'], REQ)
        self.assertEqual(found[0]['说明'], '进度甲')
        self.assertEqual(found[0]['下一步'], '下一步甲')
        self.assertFalse(store.list_tasks(keyword='不存在的要求词')['任务'])
        day = store.get_day('2026-11-16')
        self.assertEqual(day['今天栏_待做'][0]['具体制作要求'], REQ)
        self.assertEqual(day['今天栏_待做'][0]['说明'], '进度甲')
        week = store.get_week('2026-11-16')
        ids = [t['id'] for t in week['本周排期']]
        self.assertIn(20260001, ids)
        self.assertTrue(any(t.get('具体制作要求') == REQ for t in week['本周排期']))

    def test_add_update_progress_reschedule_and_done_keep_boundaries(self):
        data = copy.deepcopy(BASE)
        created, _ = store.m_add_task(data, '合成新任务', plan='2026-11-18', note='新进度', next_step='新下一步',
                                      requirements='第一行\r\n第二行')
        self.assertEqual(created['requirements'], '第一行\n第二行')
        self.assertEqual(created['note'], '新进度')
        self.assertEqual(created['events'][0]['text'], '11月16日新增：新进度')
        self.assertNotIn('第一行', created['events'][0]['text'])
        blank, _ = store.m_add_task(data, '合成无要求', plan='2026-11-18', note='只有进度')
        self.assertIsNone(blank['requirements'])
        self.assertEqual(blank['note'], '只有进度')
        store.m_update_note(data, created['id'], note='进度已改')
        self.assertEqual(created['note'], '进度已改')
        self.assertEqual(created['requirements'], '第一行\n第二行')
        self.assertEqual(len(created['events']), 1)
        store.m_update_note(data, created['id'], requirements='要求已改')
        self.assertEqual(created['requirements'], '要求已改')
        self.assertEqual(created['note'], '进度已改')
        store.m_add_progress(data, created['id'], '追加进展', '2026-11-16', False)
        self.assertEqual(created['requirements'], '要求已改')
        self.assertEqual(created['note'], '进度已改')
        self.assertEqual(created['events'][-1]['text'], '追加进展')
        store.m_reschedule(data, created['id'], '2026-11-20', reason='改期原因')
        self.assertEqual(created['plan'], '2026-11-20')
        self.assertEqual(created['requirements'], '要求已改')
        self.assertEqual(created['note'], '进度已改')
        store.m_mark_done(data, created['id'], '2026-11-20', '完成记录')
        self.assertTrue(created['done'])
        self.assertEqual(created['requirements'], '要求已改')
        self.assertEqual(created['note'], '进度已改')
        store.m_update_note(data, created['id'], requirements='   ')
        self.assertIsNone(created['requirements'])
        self.assertEqual(created['note'], '进度已改')
        untouched = task(data, 20260001)
        self.assertEqual(untouched['requirements'], REQ)
        self.assertEqual(untouched['note'], '进度甲')

    def test_missing_requirements_argument_does_not_clear(self):
        data = copy.deepcopy(BASE)
        before = task(data, 20260001)['requirements']
        store.m_update_note(data, 20260001, next_step='只改下一步')
        self.assertEqual(task(data, 20260001)['requirements'], before)
        self.assertEqual(task(data, 20260001)['note'], '进度甲')
        self.assertEqual(task(data, 20260001)['next'], '只改下一步')
        with self.assertRaises(ValueError):
            store.m_update_note(data, 20260001)
        with self.assertRaises(ValueError):
            store.clean_requirements('x' * 4001)

    def test_disk_roundtrip_keeps_old_shape(self):
        raw = json.loads((ROOT / 'build' / 'data.json').read_text(encoding='utf-8'))
        self.assertNotIn('requirements', raw['tasks'][1])
        self.assertEqual(raw['tasks'][0]['requirements'], REQ)


if __name__ == '__main__':
    unittest.main(verbosity=2)
