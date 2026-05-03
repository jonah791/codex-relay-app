#!/usr/bin/env node
const { start } = require('./relay');
const path = require('path');
const fs = require('fs');

// Load .env.ps1 if exists
const envFile = path.join(__dirname, '.env.ps1');
if (fs.existsSync(envFile)) {
  require('child_process').execSync(`powershell -ExecutionPolicy Bypass -File "${envFile}"`, { stdio: 'ignore' });
}

// Load config.json if exists
let config = {};
const cfgPath = path.join(__dirname, 'config.json');
if (fs.existsSync(cfgPath)) {
  config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

// Load providers
const providers = JSON.parse(fs.readFileSync(path.join(__dirname, 'providers.json'), 'utf8'));

const provider = config.provider || 'opencode-go';
const prov = provider === 'custom'
  ? { upstream: config.custom_upstream || '', models: config.custom_models || {} }
  : providers[provider] || providers['opencode-go'];

const apiKey = config.api_key || process.env.CODEX_RELAY_API_KEY || '';
const upstream = prov.upstream || process.env.CODEX_RELAY_UPSTREAM || 'https://opencode.ai/zen/go/v1';
const modelMap = prov.models || { 'gpt-5.5': 'deepseek-v4-pro', 'gpt-5.4': 'deepseek-v4-flash' };
const port = config.port || parseInt(process.env.CODEX_RELAY_PORT) || 4447;

if (!apiKey) {
  console.error('ERROR: No API key configured.');
  console.error('  Set CODEX_RELAY_API_KEY env var or create config.json');
  process.exit(1);
}

console.log(`codex-relay CLI v${require('./package.json').version}`);
console.log(`  port:     ${port}`);
console.log(`  upstream: ${upstream}`);
console.log(`  provider: ${providers[provider] ? providers[provider].name : 'custom'}`);
console.log(`  map:      ${JSON.stringify(modelMap)}`);
console.log('');

start(port, upstream, apiKey, modelMap)
  .then(() => console.log(`Listening on http://127.0.0.1:${port} — Ctrl+C to stop`))
  .catch(e => { console.error('Start failed:', e.message); process.exit(1); });
