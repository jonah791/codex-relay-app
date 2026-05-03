codex-relay-merged 功能已合并至此仓库，支持 GUI + CLI 双模式。

### v1.0.3 新增

- **实时模型拉取**：设置页点击 **Fetch Models**，自动读取 Codex 本地缓存 + 上游供应商 `/v1/models`
- **下拉选择**：模型映射行改为 `<select>` 下拉菜单，无需手填模型名
- **双向数据**：Codex 侧读取 `~/.codex/models_cache.json`，上游侧直接请求 API
- **映射覆盖**：`model_overrides` 按供应商隔离存储，切换供应商自动加载对应映射

### 双模式使用

```powershell
# GUI 模式
npm start

# CLI 模式（无需 Electron）
node cli.js
```

### 旧仓库
[codex-relay-merged](https://github.com/jonah791/codex-relay-merged) 已归档。
