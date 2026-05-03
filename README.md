# Codex Relay App

系统托盘应用，一键切换 Codex CLI 供应商。将 OpenAI Responses API 翻译为 Chat Completions API，支持模型名映射。

## 安装

```powershell
git clone https://github.com/jonah791/codex-relay-app.git
cd codex-relay-app
npm install
```

## 使用

```powershell
npm start
# 或双击 start.cmd
```

任务栏出现图标后：
- **右键** → 选择供应商 → 输入 API Key
- **右键** → 启动/停止 Relay
- **右键** → 设置 → 自定义模型映射

## Codex CLI 配置

应用自动管理 `~/.codex/config.toml`：

```toml
model = "gpt-5.5"
model_provider = "opencode-go-relay"

[model_providers.opencode-go-relay]
name = "OpenCode Go"
api_base_url = "http://127.0.0.1:4447/v1"
```

## 供应商

| 供应商 | 上游 URL | 备注 |
|---|---|---|
| OpenCode Go | opencode.ai/zen/go/v1 | 首月$5，支持 DeepSeek/Kimi |
| DeepSeek | api.deepseek.com/v1 | 官方 API |
| Kimi | api.moonshot.cn/v1 | 月之暗面 |
| OpenRouter | openrouter.ai/api/v1 | 多模型聚合 |
| 自定义 | 自填 | 任意 OpenAI 兼容端点 |

## 打包

```powershell
npm run dist
```

输出 `dist/Codex Relay Setup.exe`，安装时自动创建桌面快捷方式。

## 架构

```
Codex CLI → relay.js :4447 → 上游 Chat Completions API
              ↑ 模型名映射
```

基于 [MetaFARS/codex-relay](https://github.com/MetaFARS/codex-relay) 翻译核心，添加模型名映射和系统托盘 GUI。

## License

MIT
