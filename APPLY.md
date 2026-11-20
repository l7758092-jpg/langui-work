# 源码同步

这个仓库里的 `generator/src/app.js` 和 `app.html` 对应当前线上页面，已经包含周末「休息」和年份切换。连接器对应当前 stdio 进程里的 `store.py` 和 `server.py`。

不要用旧的 `patches/generator.patch`、`patches/connector.patch`，也不要用一份更早的 `app.js` 覆盖现役 `restore/src`。那些旧补丁的基线还没有周末休息和年份切换，整文件覆盖会把现役页面退回去。不要把本仓库的 `index.html` 或任何生成结果写回生产页面，也不要改 `data.json`、`flow.test.js`、`migrate.test.js`、token 或发布锁。

每周工作汇报只同步这两份已审计补丁。先在副本上预览，没有拒绝再正式打上：

```sh
cd /workspace/langui
patch -p1 --dry-run -i /path/to/patches/weekly-report-generator.patch
cd /home/box/langui-mcp
patch -p1 --dry-run -i /path/to/patches/weekly-report-connector.patch
```

`weekly-report-generator.patch` 只含 `restore/src/app.js` 和 `restore/src/app.html`。`weekly-report-connector.patch` 只含 `store.py` 和 `server.py`。补丁相对当前现役源码。如果现役文件已经和补丁基线不一致，停下来核对，不要改用旧文件覆盖。

`save_weekly_report` 仍走原来的 `mutate`：同一把写锁、备份、生成、`flow.test.js` 与 `migrate.test.js`、只发布 index。仓库里的合成测试不替换这两项回归。连接器进程换上新的 `server.py` 之后，要用官方的 MCP 重连刷新工具 schema。本地跑测试不等于插件已经露出新工具。

## 字段约定

- `note` 仍是当前进度。
- `next` 仍是下一步。
- `requirements` 是具体制作要求。旧任务没有这个键，不要回填。
- 新增和更新时不传 `requirements` 表示不改；更新时传空字符串表示清除。
- `add_progress`、`reschedule`、`mark_done` 不改要求，也不改 `note`。
- `?edit=1` 只写入这台浏览器的 `localStorage`，不是共享录入。

## 每周工作汇报

周报放在 `data.json` 的 `weeklyReports`，不写入 `tasks`。旧文件没有这个键时，读取结果为空，任务写操作不会补一个空键。键是 `Asia/Shanghai` 的周一：`2026-01-01` 归到 `2025-12-29`。同一周一再次保存只更新 `projects` 和 `followups`，并保留这条周报上已有的其他元数据键。保存另一周不覆盖旧周。

每个项目单独有 `name`、`emoji`、`status`，状态不要写进名称。`blocks` 按类型使用固定标签，标签后的 `status` 和 `text` 按周变化：

- `制作`：文案、配音、素材、片头、字幕、横版、竖版。`track` 为 `education` 时可以再使用脚本、片尾。横版显示 16:9，竖版显示 9:16，两项必须分开。
- `逐日进展`：周一、周二、周三、剪辑、交片。
- `会议`：`会议`，或周几加上午/下午（例如周二上午）。每行用 `attendance` 标明已参加或待参加，正文写明日期。
- `拍摄/交付跟进`：只放在 `followups`。标签是时间、到场、地点、人员、工作、拍摄、内容、素材截止、后续、交片。

不要把这些标签改成文案或素材，也不要把多行拼成一段。后续事项的页面标题仍是「后续工作跟进」。

页面入口是「本周工作汇报」。地址栏已经有 `week` 时，按钮打开这一周的汇报，不改去今天所在的周；没有 `week` 时才用上海时间的本周一。深链接形如 `?week=YYYY-MM-DD#weekly-work-report`。原来的「本周做了什么」和「整体汇报」保留。不要把真实周报正文写进仓库、测试或提交说明。

## 验证

合成测试在仓库里跑：`python3 connector/store_requirements_test.py`、`python3 connector/store_weekly_report_test.py`，以及生成源目录的 `node weekly-report.test.js`、`node requirements.test.js`。页面测试需要本机已有的 `puppeteer-core` 和 Chrome。生产环境的 `flow.test.js` 和 `migrate.test.js` 仍由原流水线在锁内运行。确认补丁无误之后，才在现有锁里做真实写入。不要把真实工作正文贴进说明。
