# Codex Relay - CLI 模式启动器
# 使用前创建 .env.ps1: echo '$env:CODEX_RELAY_API_KEY = "sk-..."' > .env.ps1

param([switch]$Cli)

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $dir ".env.ps1"

if (Test-Path $envFile) { . $envFile }

if (-not $Cli) {
    # GUI mode (default)
    Write-Host "Starting Codex Relay (GUI)..." -ForegroundColor Cyan
    npm start --prefix $dir
} else {
    # CLI mode
    Write-Host "Starting Codex Relay (CLI)..." -ForegroundColor Cyan
    node "$dir\cli.js"
}
