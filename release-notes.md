我们正式发布 **Codex Relay v1.0.2** —— 一款极简的系统托盘工具，让 Codex CLI 用户能一键在 OpenAI 与第三方供应商之间切换。

本版本基于 [MetaFARS/codex-relay](https://github.com/MetaFARS/codex-relay) 翻译引擎，新增模型名映射、多供应商、托盘菜单和 Electron 桌面封装。

---

### v1.0.2 修复

- 修复系统托盘图标不显示的问题（改用真实 .ico 文件替代 SVG 生成）
- 修复桌面快捷方式创建失败（改用 Electron 原生 API `shell.writeShortcutLink`）
- 修复未配置 API Key 时"启动 Relay"无反应（添加气泡提示引导用户填写）
- 修复供应商上游为空时静默失败（添加提示）

### 功能

- 系统托盘图标，右键操控一切
- 5 个内置供应商（OpenCode Go / DeepSeek / Kimi / OpenRouter / 自定义）
- 模型名映射（gpt-5.5 → deepseek-v4-pro）
- Responses API → Chat Completions 翻译
- 自动管理 Codex config.toml
- 一键重启 Codex CLI
- 设置弹窗（API Key、端口、模型映射、开机自启）
- 桌面快捷方式自动创建

### 下载

⬇️ **Codex-Relay-v1.0.2.exe** — 便携版，双击运行

### 启动

```powershell
git clone https://github.com/jonah791/codex-relay-app.git
cd codex-relay-app
npm install
npm start
```
