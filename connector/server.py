"""LanGui 专业工作库 MCP 连接器。用法：server.py stdio | server.py http"""
import os, sys, hmac, asyncio, functools
from typing import Optional
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
import store

INSTR = ('Ke（LanGui）的专业工作库：读写他的工作记录，网页 https://l7758092-jpg.github.io/langui-work/ 。'
         '规则：「今天」栏只显示计划日=今天的任务；完成要写完成日；改期只改计划日，原计划日自动保留；急事排前；不要编造记录，只记 Ke 说过的。'
         '每周工作汇报是独立记录，用 save_weekly_report、get_weekly_report、list_weekly_reports；周一为键，不要写进任务进展。'
         '周报按块保存：制作、逐日进展、会议、拍摄/交付跟进。标签不能改称文案或素材，项目状态和 emoji 不要拼进名称。'
         '写操作会自动生成网页、跑测试、推送上线并核对，约 20–60 秒。时区 Asia/Shanghai。')
mcp = FastMCP('LanGui 专业工作库', instructions=INSTR, stateless_http=True, json_response=True,
              transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False))

async def _w(fn, *a, **kw):
    return await asyncio.to_thread(store.mutate, fn, *a, **kw)
async def _r(fn, *a, **kw):
    return await asyncio.to_thread(fn, *a, **kw)

@mcp.tool(description='查某一天的工作：今天栏的待做和已完成、当天进展、当天截止。day 为 YYYY-MM-DD，不填就是今天（上海时间）。')
async def get_day(day: Optional[str] = None) -> dict:
    return await _r(store.get_day, day)

@mcp.tool(description='查某一周（周一到周日）的工作：本周排期（含延后未完成）、待安排、已完成、有进展的任务、截止。day 填这周里任意一天，不填就是本周。')
async def get_week(day: Optional[str] = None) -> dict:
    return await _r(store.get_week, day)

@mcp.tool(description='按条件列出任务。month：YYYY-MM 或 YYYY；keyword：搜标题/当前说明（进度）/下一步/具体制作要求/进展；status：全部、未完成、已完成；plan_from/plan_to：计划日范围 YYYY-MM-DD；include_hidden：是否含隐藏记录；limit：最多返回几条（默认 50）。')
async def list_tasks(month: Optional[str] = None, keyword: Optional[str] = None, status: str = '全部',
                     plan_from: Optional[str] = None, plan_to: Optional[str] = None,
                     include_hidden: bool = False, limit: int = 50) -> dict:
    return await _r(store.list_tasks, month, keyword, status, plan_from, plan_to, include_hidden, limit)

@mcp.tool(description='查看一条任务的全部字段和所有进展。task 填任务编号（如 20260146）或名称（可只写一部分）。')
async def get_task(task: str) -> dict:
    return await _r(store.get_task, task)

@mcp.tool(description='给任务记一条进展（写操作，会自动发布到网页）。task：编号或名称；text：进展内容，只写 Ke 说过的；day：进展日期，默认今天；done=true 表示这条进展意味着任务完成，会同时标记完成、完成日=day。')
async def add_progress(task: str, text: str, day: Optional[str] = None, done: bool = False) -> dict:
    return await _w(store.m_add_progress, task, text, day, done)

@mcp.tool(description='把任务标记为完成（写操作，会自动发布）。完成日 day 默认今天；text 是完成时记的进展，不填就写「X月X日<任务>已完成。」。只有计划日=完成日的任务才会出现在那天的今天栏。')
async def mark_done(task: str, day: Optional[str] = None, text: Optional[str] = None) -> dict:
    return await _w(store.m_mark_done, task, day, text)

@mcp.tool(description='新增一条任务（写操作，会自动发布）。编号自动取今年最大编号+1。plan：计划日 YYYY-MM-DD（排进那天的今天栏）；不填则放进本周待安排；deadline：交付/截止日；note：当前说明，也就是进度，不是制作要求；requirements：具体制作要求，可选，不填则没有要求，不会从 note 复制；next_step：下一步；date_text：网页上显示的日期文字（默认「X月X日」）；month：归档月份（默认按计划日或今天）；urgent：是否急事。')
async def add_task(title: str, plan: Optional[str] = None, deadline: Optional[str] = None, note: Optional[str] = None,
                   next_step: Optional[str] = None, date_text: Optional[str] = None, month: Optional[str] = None,
                   urgent: bool = False, requirements: Optional[str] = None) -> dict:
    return await _w(store.m_add_task, title, plan, deadline, note, next_step, date_text, month, urgent, requirements=requirements)

@mcp.tool(description='任务改期（写操作，会自动发布）。只改计划日 new_plan（YYYY-MM-DD），第一次改期时原计划日自动保留在「原计划」，以后再改也不覆盖。reason：改期原因（会记成一条进展）；date_text：可同时改网页上的日期文字。')
async def reschedule(task: str, new_plan: str, reason: Optional[str] = None, date_text: Optional[str] = None) -> dict:
    return await _w(store.m_reschedule, task, new_plan, reason, date_text)

@mcp.tool(description='更新任务的说明和其他字段（写操作，会自动发布）。只改填了的项：note 当前说明（进度），requirements 具体制作要求（不填表示不改，传空字符串表示清除；不会改动 note），next_step 下一步、deadline 交付日（传空字符串清除）、date_text 日期文字、title 标题、urgent 是否急事。')
async def update_note(task: str, note: Optional[str] = None, next_step: Optional[str] = None, deadline: Optional[str] = None,
                      date_text: Optional[str] = None, title: Optional[str] = None, urgent: Optional[bool] = None,
                      requirements: Optional[str] = None) -> dict:
    return await _w(store.m_update_note, task, note, next_step, deadline, date_text, title, urgent, requirements)

@mcp.tool(description='核对线上网页是否已经是最新版本（比较本地生成的网页和 GitHub Pages 上的内容）。')
async def check_online() -> dict:
    return await _r(store.check_online)

@mcp.tool(description='保存独立的每周工作汇报（写操作，走原有备份、生成、回归和发布，不改任务、不追加进展）。week 必须显式填写 YYYY-MM-DD，按 Asia/Shanghai 归到周一；同一周一再次保存只更新 projects 与 followups，并保留该周报对象上已有的其他元数据键；另起一周不会覆盖旧周。projects 是项目列表，followups 是「后续工作跟进」，可省略。每个项目单独填写 name、emoji、status（完成或进行等，禁止拼进 name）；track 默认 general，education 的制作块才可用脚本、片尾。blocks 按 type 分块，标签用 label，不可改名或合并：制作=文案、配音、素材、片头、字幕、横版、竖版（教育类另加脚本、片尾），横版与竖版必须各占一行；逐日进展=周一、周二、周三、剪辑、交片；会议=会议或周几上午/下午（如周二上午），每行 attendance 只能是已参加或待参加，text 必须写明 YYYY-MM-DD 或 M月D日，已参加和待参加各自成行；followups 是后续工作跟进，可放拍摄/交付跟进（label=时间、到场、地点、人员、工作、拍摄、内容、素材截止、后续、交片），也可放待参加会议。已参加会议留在 projects，不能放进 followups。制作和逐日进展不能放进 followups。每行另有 emoji、可选 status、text。这些标签后的 status 和 text 只属于这一周。')
async def save_weekly_report(week: str, projects: list, followups: Optional[list] = None) -> dict:
    return await _w(store.m_save_weekly_report, week, projects, followups)

@mcp.tool(description='读取某一周的独立工作汇报，不读取任务进展。week 为 YYYY-MM-DD，按 Asia/Shanghai 归到周一；不填则用上海时间的本周一。没有记录时返回该周一的空态，不会改用其他周的内容。')
async def get_weekly_report(week: Optional[str] = None) -> dict:
    return await _r(store.get_weekly_report, week)

@mcp.tool(description='按周一日期列出已保存的独立工作汇报。不含任务。')
async def list_weekly_reports() -> dict:
    return await _r(store.list_weekly_reports)

# ── HTTP：鉴权（URL 路径带 token 或 Authorization: Bearer token） ──
def http_app():
    token = open(os.environ.get('LANGUI_TOKEN_FILE', '/home/box/langui-mcp/secret/token')).read().strip()
    assert len(token) >= 32
    inner = mcp.streamable_http_app()
    async def app(scope, receive, send):
        if scope['type'] == 'lifespan': return await inner(scope, receive, send)
        path = scope.get('path', '')
        if scope['type'] == 'http' and path in ('/health', '/healthz'):
            await send({'type': 'http.response.start', 'status': 200, 'headers': [(b'content-type', b'text/plain')]})
            return await send({'type': 'http.response.body', 'body': b'ok'})
        ok = False
        if path.startswith('/mcp/'):
            seg = path[5:].split('/', 1)
            if hmac.compare_digest(seg[0], token):
                ok = True; scope = dict(scope, path='/mcp' + ('/' + seg[1] if len(seg) > 1 else ''), raw_path=None)
        elif path in ('/mcp', '/mcp/'):
            auth = dict(scope.get('headers') or []).get(b'authorization', b'').decode()
            if auth.lower().startswith('bearer ') and hmac.compare_digest(auth[7:].strip(), token): ok = True
        if not ok:
            await send({'type': 'http.response.start', 'status': 401, 'headers': [(b'content-type', b'application/json'), (b'www-authenticate', b'Bearer')]})
            return await send({'type': 'http.response.body', 'body': b'{"error":"unauthorized"}'})
        return await inner(scope, receive, send)
    return app

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'stdio'
    if mode == 'http':
        import uvicorn
        uvicorn.run(http_app(), host='127.0.0.1', port=int(os.environ.get('LANGUI_PORT', '18765')), log_level='warning')
    else:
        mcp.run('stdio')
