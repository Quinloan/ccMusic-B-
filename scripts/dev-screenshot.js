// 开发用：启动界面截图。用法 node scripts/dev-screenshot.js <输出.png> [--menu]
// 独立入口，不加载 main.js 的业务逻辑，只渲染 renderer/index.html
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const out = process.argv[2] || 'shot.png';
const openMenu = process.argv.includes('--menu');
const openAbout = process.argv.includes('--about');
const testBack = process.argv.includes('--back');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    frame: false,
    backgroundColor: '#f7f7f9',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 2000));
  if (testBack) {
    const r = await win.webContents.executeJavaScript(
      "(function(){ showView('diag'); showView('about'); goBack(); return S.view; })()"
    );
    console.log('back-result:', r, '(期望 diag)');
  }
  if (openAbout) {
    await win.webContents.executeJavaScript(
      "typeof showView === 'function' ? (showView('about'), 'ok') : 'no-fn'"
    );
    await new Promise((r) => setTimeout(r, 400));
    await win.webContents.executeJavaScript(
      "document.querySelector('#playSettings')?.scrollIntoView({ block: 'start' }); 'ok'"
    );
    await new Promise((r) => setTimeout(r, 300));
  }
  if (openMenu) {
    await win.webContents.executeJavaScript(
      "typeof openAccountMenu === 'function' ? (openAccountMenu(), 'ok') : 'no-fn'"
    );
    await new Promise((r) => setTimeout(r, 350));
  }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  console.log('saved:', out);
  app.exit(0);
});
