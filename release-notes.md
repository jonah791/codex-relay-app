codex-relay-merged 功能已合并至 codex-relay-app。现在一个仓库支持双模式。

### 新增
- CLI 模式（`node cli.js` 或 `.\start.ps1 -Cli`），无需 Electron
- PowerShell 启动器（`start.ps1`）

### 双模式对比

| | GUI 模式 | CLI 模式 |
|---|---|---|
| 启动 | `npm start` / 双击 EXE | `node cli.js` |
| 依赖 | Electron (~80MB) | Node.js 内置 |
| 界面 | 系统托盘右键菜单 | 终端 Ctrl+C 停止 |
| 适用 | 日常使用 | 轻量部署 / 后台服务 |

### 下载
⬇️ **Codex-Relay-v1.0.3.exe**

### 旧仓库
[codex-relay-merged](https://github.com/jonah791/codex-relay-merged) 已归档。
