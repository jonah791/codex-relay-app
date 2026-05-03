const { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage, shell } = require('electron');
const { start: startRelay } = require('./relay');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let tray = null;
let relayServer = null;
let providers = {};
let config = {};
let cfgDir, cfgPath;
let codexCfg;

function loadConfig() {
  const def = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.default.json'), 'utf8'));
  if (fs.existsSync(cfgPath)) {
    config = { ...def, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
  } else {
    config = { ...def };
    saveConfig();
  }
}

function saveConfig() {
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2));
}

function loadProviders() {
  providers = JSON.parse(fs.readFileSync(path.join(__dirname, 'providers.json'), 'utf8'));
}

function getRelayProv() {
  const pid = config.provider;
  const overrides = (config.model_overrides && config.model_overrides[pid]) || {};
  if (pid === 'custom') {
    return { upstream: config.custom_upstream || '', models: { ... config.custom_models, ...overrides } };
  }
  const base = providers[pid] || providers['opencode-go'];
  return { upstream: base.upstream, models: { ...base.models, ...overrides } };
}

function getCodexMode() {
  if (!fs.existsSync(codexCfg)) return 'openai';
  const content = fs.readFileSync(codexCfg, 'utf8');
  return /^\s*model_provider\s*=\s*"opencode-go-relay"/m.test(content) ? 'go' : 'openai';
}

function setCodexMode(mode) {
  if (!fs.existsSync(codexCfg)) return;
  const lines = fs.readFileSync(codexCfg, 'utf8').split('\n');
  let found = false;
  const out = lines.map(line => {
    if (/^#?\s*model_provider\s*=\s*"opencode-go-relay"/.test(line)) {
      found = true;
      return mode === 'go' ? 'model_provider = "opencode-go-relay"' : '# model_provider = "opencode-go-relay"';
    }
    return line;
  });
  if (!found && mode === 'go') {
    const modelIdx = out.findIndex(l => l.startsWith('model ='));
    if (modelIdx >= 0) out.splice(modelIdx + 1, 0, 'model_provider = "opencode-go-relay"');
    else out.unshift('model_provider = "opencode-go-relay"');
  }
  fs.writeFileSync(codexCfg, out.join('\n'), 'utf8');
}

function restartCodex() {
  try { execSync('taskkill /f /im Codex.exe', { stdio: 'ignore' }); } catch {}
  try { execSync('taskkill /f /im codex.exe', { stdio: 'ignore' }); } catch {}
  shell.openPath('shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App');
}

function balloon(title, content) {
  if (!tray) return;
  try { tray.displayBalloon({ title, content, icon: 'warning' }); } catch {}
}

async function startRelayProcess() {
  if (relayServer) return;
  const prov = getRelayProv();
  if (!config.api_key) {
    balloon('Relay', '请在设置中填写 API Key');
    return;
  }
  if (!prov.upstream) {
    balloon('Relay', '请选择有效的供应商');
    return;
  }
  try {
    relayServer = await startRelay(config.port, prov.upstream, config.api_key, prov.models || {});
  } catch (e) {
    balloon('Relay Failed', e.message || '端口可能被占用');
  }
}

async function stopRelayProcess() {
  if (relayServer) { relayServer.close(); relayServer = null; }
}

function ensureShortcut() {
  if (config.shortcut_created) return;
  try {
    const desktop = path.join(require('os').homedir(), 'Desktop');
    const shortcut = path.join(desktop, 'Codex Relay.lnk');
    if (fs.existsSync(shortcut)) { config.shortcut_created = true; saveConfig(); return; }
    const ok = shell.writeShortcutLink(shortcut, {
      target: process.execPath,
      workingDirectory: path.dirname(process.execPath),
      icon: path.join(__dirname, 'build', 'icon.ico'),
      iconIndex: 0,
    });
    if (ok || fs.existsSync(shortcut)) {
      config.shortcut_created = true;
      saveConfig();
    }
  } catch (e) {
    console.warn('Shortcut creation failed:', e.message);
  }
}

function openSettings() {
  const existing = BrowserWindow.getAllWindows().find(w => w.title === 'settings');
  if (existing) { existing.focus(); return; }
  const sw = new BrowserWindow({
    width: 440, height: 480, resizable: false, title: 'settings',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
  });
  sw.setMenuBarVisibility(false);
  sw.loadFile('settings.html');
}

function loadTrayIcon(name) {
  const ico = path.join(__dirname, 'build', `icon-${name}.ico`);
  if (fs.existsSync(ico)) return nativeImage.createFromPath(ico);
  // fallback SVG
  const c = { green: '#00cc44', blue: '#2080ff', gray: '#888888' }[name];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="${c}"/></svg>`;
  return nativeImage.createFromDataURL('data:image/svg+xml,' + encodeURIComponent(svg)).resize({ width: 16, height: 16 });
}

function buildMenu() {
  const running = !!relayServer;
  const provMenu = Object.entries(providers).map(([key, p]) => ({
    label: (config.provider === key ? '✓ ' : '   ') + p.name,
    type: 'radio', checked: config.provider === key,
    click: () => { config.provider = key; saveConfig(); stopRelayProcess(); startRelayProcess(); process.nextTick(() => updateIcon()); },
  }));

  return Menu.buildFromTemplate([
    { label: '供应商', submenu: provMenu },
    { type: 'separator' },
    { label: '启动 Relay', enabled: !running, click: async () => { await startRelayProcess(); process.nextTick(() => updateIcon()); } },
    { label: '停止 Relay', enabled: running, click: async () => { await stopRelayProcess(); process.nextTick(() => updateIcon()); } },
    { label: '重启 Codex', click: () => restartCodex() },
    { type: 'separator' },
    { label: '设置...', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: () => { tray.destroy(); stopRelayProcess().catch(() => {}).finally(() => app.quit()); } },
  ]);
}

function updateIcon() {
  if (!tray) return;
  const mode = getCodexMode();
  if (mode === 'go' && relayServer) tray.setImage(loadTrayIcon('green'));
  else if (mode === 'go') tray.setImage(loadTrayIcon('gray'));
  else tray.setImage(loadTrayIcon('blue'));
  const prov = providers[config.provider];
  tray.setToolTip(`Codex Relay - ${prov ? prov.name : '?'} | ${mode === 'go' ? 'Go mode' : 'OpenAI'}`);
  tray.setContextMenu(buildMenu());
}

function setupIPC() {
  ipcMain.handle('get-config', () => config);
  ipcMain.handle('get-providers', () => providers);

  ipcMain.handle('fetch-codex-models', () => {
    const p = path.join(require('os').homedir(), '.codex', 'models_cache.json');
    try {
      if (!fs.existsSync(p)) return { error: 'Codex models_cache.json not found. Open Codex first.' };
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return (data.models || []).map(m => ({ id: m.slug, name: m.display_name || m.slug }));
    } catch (e) { return { error: 'Failed to read Codex models: ' + e.message }; }
  });

  ipcMain.handle('fetch-upstream-models', async (_, upstreamUrl, apiKey) => {
    if (!upstreamUrl) return { error: 'No upstream URL configured' };
    const { request } = require(upstreamUrl.startsWith('https') ? 'https' : 'http');
    return new Promise((resolve) => {
      try {
        const u = new URL(upstreamUrl.replace(/\/+$/, '') + '/models');
        const opts = { hostname: u.hostname, path: u.pathname, method: 'GET', headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} };
        const r = request(opts, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(d);
              if (parsed.error) resolve({ error: parsed.error.message || 'API error' });
              else resolve((parsed.data || []).map(m => m.id));
            } catch { resolve({ error: 'Failed to parse upstream response' }); }
          });
        });
        r.on('error', (e) => resolve({ error: e.message }));
        r.end();
      } catch (e) { resolve({ error: 'Invalid upstream URL: ' + e.message }); }
    });
  });

  ipcMain.handle('save-config', async (_, newCfg) => {
    config = { ...config, ...newCfg }; saveConfig();
    if (!config.autostart_relay) await stopRelayProcess();
    else await startRelayProcess();
    app.setLoginItemSettings({ openAtLogin: config.autostart, path: process.execPath });
    process.nextTick(() => updateIcon());
  });
}

app.whenReady().then(async () => {
  cfgDir = app.getPath('userData');
  cfgPath = path.join(cfgDir, 'config.json');
  codexCfg = path.join(require('os').homedir(), '.codex', 'config.toml');

  loadConfig();
  loadProviders();
  setupIPC();

  app.setLoginItemSettings({ openAtLogin: !!config.autostart, path: process.execPath });
  ensureShortcut();

  tray = new Tray(loadTrayIcon('blue'));
  updateIcon();
  tray.setToolTip('Codex Relay');

  if (config.autostart_relay && config.api_key) await startRelayProcess();
  updateIcon();
});

app.on('window-all-closed', () => {});

app.on('before-quit', async () => {
  await stopRelayProcess().catch(() => {});
});
