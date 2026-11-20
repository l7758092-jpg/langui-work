# 把具体制作要求写回本机源码

这次只准备源码和补丁，不改线上 `index.html`，也不写真实 `data.json`。本机在应用并自行验证之前，不要运行会整页生成并推送的 `mutate`。本机现有 `restore/src/app.js` 没有已上线的周末「休息」和年份切换；下一次整页生成会盖掉这两项。本目录里的 `generator/src/app.js` 以当前线上脚本为底，这两项都在。

## 要替换的文件

生成源，放到 `/workspace/langui/`：

- `generator/src/app.js` → `restore/src/app.js`
- `generator/src/app.html` → `restore/src/app.html`
- `generator/src/build.py` → `restore/src/build.py`
- `generator/src/requirements.test.js` → `restore/src/requirements.test.js`

连接器，放到 `/home/box/langui-mcp/`：

- `connector/store.py` → `store.py`
- `connector/server.py` → `server.py`
- `connector/store_requirements_test.py` → `store_requirements_test.py`

不要替换 `flow.test.js`、`migrate.test.js`、`bin/`、token、`data.json` 或已生成的网页。`build.py` 的默认路径仍是 `/workspace/langui`。

## 用补丁而不是整文件覆盖时

先在副本上预览。

```sh
cd /workspace/langui
patch -p1 --dry-run -i /path/to/patches/generator.patch
cd /home/box/langui-mcp
patch -p1 --dry-run -i /path/to/patches/connector.patch
```

`--dry-run` 没有拒绝后，去掉它再执行。补丁相对本机当前的 `restore/src/app.js`（不含周末/年份修复）。如果本机文件已经手动改过，改用上面的整文件复制。

## 字段约定

- `note` 仍是当前进度。
- `next` 仍是下一步。
- `requirements` 是具体制作要求。旧任务没有这个键，不要回填。
- 新增和更新时不传 `requirements` 表示不改；更新时传空字符串表示清除。
- `add_progress`、`reschedule`、`mark_done` 不改要求，也不改 `note`。
- `?edit=1` 只写入这台浏览器的 `localStorage`，不是共享录入。

## 每周工作汇报

周报放在 `data.json` 的 `weeklyReports`，不写入 `tasks`。旧文件没有这个键时，读取结果为空，任务写操作不会补一个空键。键是 `Asia/Shanghai` 的周一：`2026-01-01` 归到 `2025-12-29`。同一周一再次保存只更新这一条；保存另一周不覆盖已有周。

工序标签固定为「文案、配音、素材、片头、字幕、横版、竖版」。`track` 为 `education` 时可以再使用「脚本、片尾」。横版显示 16:9，竖版显示 9:16，两项必须分开。`emoji`、`status`、`text` 按周变化，页面不写死某一周的正文。后续事项放在 `followups`，页面标题为「后续工作跟进」。

stdio 工具：`save_weekly_report`、`get_weekly_report`、`list_weekly_reports`。`save_weekly_report` 仍走原来的 `mutate`（同一把写锁、备份、生成、`flow.test.js` 与 `migrate.test.js`、只发布 index）。仓库里的合成测试不替换这两项回归。连接器进程换上新的 `server.py` 之后，要用官方的 MCP 重连刷新工具 schema；本地跑测试不等于插件已经露出新工具。

页面入口是「本周工作汇报」，深链接形如 `?week=YYYY-MM-DD#weekly-work-report`。原来的「本周做了什么」和「整体汇报」保留。不要把真实周报正文写进仓库、测试或提交说明。

## 本机验证后再发布

1. 复制源码后重启连接器进程，使新工具参数生效。不要用生产数据先跑写操作。
2. 可再跑一次合成测试：`python3 store_requirements_test.py`，以及在生成源目录 `node requirements.test.js`。页面测试需要本机已有的 `puppeteer-core` 和 Chrome。
3. 确认无误后，才用现有 `mutate` 流水线做第一次真实写入。那一次会按新源码整页生成；因为源码已包含周末和年份修复，不会把它们退回去。
4. 发布后核对线上页面仍有「休息」、年份统计，以及一条只含合成或新录入要求的任务。不要把真实工作正文贴进说明。
