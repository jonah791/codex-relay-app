const { app, Menu, Tray, BrowserWindow, ipcMain, nativeImage, shell, dialog } = require('electron');
const { start: startRelay } = require('./relay');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// ── paths ──
const cfgDir = app.getPath('userData');
const cfgPath = path.join(cfgDir, 'config.json');
const provPath = path.join(__dirname, 'providers.json');
const codexCfg = path.join(require('os').homedir(), '.codex', 'config.toml');
const isPacked = app.isPackaged;

// ── state ──
let tray = null;
let relayServer = null;
let providers = {};
let config = {};

// ── helpers ──
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
  providers = JSON.parse(fs.readFileSync(provPath, 'utf8'));
}

function getRelayProv() {
  if (config.provider === 'custom') {
    return { upstream: config.custom_upstream, models: config.custom_models };
  }
  return providers[config.provider] || providers['opencode-go'];
}

// ── codex config.toml ──
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
  exec('taskkill /f /im Codex.exe', () => {
    exec('taskkill /f /im codex.exe', () => {
      shell.openPath('shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App');
    });
  });
}

// ── relay ──
async function startRelayProcess() {
  if (relayServer) return;
  const prov = getRelayProv();
  if (!config.api_key) {
    if (BrowserWindow.getAllWindows().length === 0) openSettings();
    return;
  }
  try {
    relayServer = await startRelay(config.port, prov.upstream, config.api_key, prov.models);
  } catch (e) {
    console.error('Relay start failed:', e.message);
  }
}

async function stopRelayProcess() {
  if (relayServer) { relayServer.close(); relayServer = null; }
}

// ── desktop shortcut ──
function ensureShortcut() {
  if (config.shortcut_created) return;
  const desktop = path.join(require('os').homedir(), 'Desktop');
  const shortcut = path.join(desktop, 'Codex Relay.lnk');
  if (fs.existsSync(shortcut)) { config.shortcut_created = true; saveConfig(); return; }
  try {
    const exe = process.execPath;
    const ico = path.join(__dirname, 'build', 'icon.ico');
    const ps = `$ws=(New-Object -COM WScript.Shell).CreateShortcut('${shortcut}');$ws.TargetPath='${exe}';$ws.WorkingDirectory='${path.dirname(exe)}';$ws.IconLocation='${ico}';$ws.Save()`;
    exec(`powershell -Command "${ps}"`, { stdio: 'ignore' });
    config.shortcut_created = true;
    saveConfig();
  } catch {}
}

// ── settings window ──
function openSettings() {
  const win = BrowserWindow.getAllWindows().find(w => w.title === 'settings');
  if (win) { win.focus(); return; }
  const sw = new BrowserWindow({
    width: 440, height: 480, resizable: false, title: 'settings',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
  });
  sw.setMenuBarVisibility(false);
  sw.loadFile('settings.html');
}

// ── tray icon ──
function makeIcon(color) {
  const c = { green: '#00cc44', blue: '#2080ff', gray: '#888888' }[color];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="${c}"/></svg>`;
  return nativeImage.createFromDataURL('data:image/svg+xml,' + encodeURIComponent(svg)).resize({ width: 16, height: 16 });
}

function buildMenu() {
  const mode = getCodexMode();
  const running = !!relayServer;
  const prov = providers[config.provider];

  const provMenu = Object.entries(providers).map(([key, p]) => ({
    label: (config.provider === key ? '✓ ' : '   ') + p.name,
    type: 'radio', checked: config.provider === key,
    click: () => { config.provider = key; saveConfig(); updateIcon(); buildMenu(); },
  }));

  return Menu.buildFromTemplate([
    { label: '供应商', submenu: provMenu },
    { type: 'separator' },
    { label: '启动 Relay', enabled: !running, click: async () => { await startRelayProcess(); updateIcon(); buildMenu(); } },
    { label: '停止 Relay', enabled: running, click: async () => { await stopRelayProcess(); updateIcon(); buildMenu(); } },
    { label: '重启 Codex', click: () => restartCodex() },
    { type: 'separator' },
    { label: '设置...', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: () => { tray.destroy(); stopRelayProcess().then(() => app.quit()); } },
  ]);
}

function updateIcon() {
  if (!tray) return;
  const mode = getCodexMode();
  if (mode === 'go' && relayServer) tray.setImage(makeIcon('green'));
  else if (mode === 'go') tray.setImage(makeIcon('gray'));
  else tray.setImage(makeIcon('blue'));
  const prov = providers[config.provider];
  tray.setToolTip(`Codex Relay - ${prov ? prov.name : '?'} | ${mode === 'go' ? 'Go mode' : 'OpenAI'}`);
  tray.setContextMenu(buildMenu());
}

// ── IPC ──
function setupIPC() {
  ipcMain.handle('get-config', () => config);
  ipcMain.handle('get-providers', () => providers);
  ipcMain.handle('save-config', (_, newCfg) => {
    config = { ...config, ...newCfg }; saveConfig();
    stopRelayProcess().then(async () => {
      if (config.autostart_relay) await startRelayProcess();
      updateIcon();
    });
  });
}

// ── app lifecycle ──
app.whenReady().then(async () => {
  loadConfig();
  loadProviders();
  setupIPC();

  app.setLoginItemSettings({ openAtLogin: config.autostart });

  tray = new Tray(makeIcon('blue'));
  updateIcon();
  tray.setToolTip('Codex Relay');

  if (!isPacked || !config.shortcut_created) ensureShortcut();

  if (config.autostart_relay && config.api_key) await startRelayProcess();
  updateIcon();
});

app.on('window-all-closed', () => {});

app.on('before-quit', async () => {
  await stopRelayProcess();
});
