// 开发用：启动界面截图。用法 node scripts/dev-screenshot.js <输出.png> [--menu]
// 独立入口，不加载 main.js 的业务逻辑，只渲染 renderer/index.html
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const out = process.argv[2] || 'shot.png';
const openMenu = process.argv.includes('--menu');

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
