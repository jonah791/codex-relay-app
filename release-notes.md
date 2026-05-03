codex-relay-merged 功能已合并至此仓库，支持 GUI + CLI 双模式。

### v1.0.4

- 修复托盘气泡 API（`displayBalloon` 替代 `showBalloon`，Electron 35 兼容）
- relay 启动失败时弹出气泡错误提示
- 快捷方式创建失败添加日志警告
- 设置页 fetch 失败时红色 toast 错误提示
- 上游 API 错误返回 `{ error }` 对象，UI 正确识别
- Codex cache 未找到时提示 "Open Codex first"
- 模型映射行用 DOM API 替代 innerHTML（防 XSS）
- 供应商切换自动重启 relay
- 修复映射行重复渲染

### 双模式使用

```powershell
# GUI 模式
npm start

# CLI 模式（无需 Electron）
node cli.js
```

### 旧仓库
[codex-relay-merged](https://github.com/jonah791/codex-relay-merged) 已归档。
