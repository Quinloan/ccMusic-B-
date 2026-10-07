// 探测：当前登录态下，B 站到底给不给 FLAC 音轨
// 用法: node scripts/probe-flac.js <bvid> <cid>
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow } = require('electron');

const BVID = process.argv[2] || 'BV1FPjy6TEiE';
const CID = process.argv[3] || '39252201332';

// 复制真实登录态到临时 userData，不碰用户数据
app.setName('ccMusic'); // 让 userData 指向 %APPDATA%\ccMusic
const real = path.join(app.getPath('userData'), 'radio-data.json');
const tmp = path.join(os.tmpdir(), 'ccmusic-flac-probe');
fs.mkdirSync(tmp, { recursive: true });
try {
  const d = JSON.parse(fs.readFileSync(real, 'utf8'));
  fs.writeFileSync(path.join(tmp, 'radio-data.json'), JSON.stringify({ cookies: d.cookies }));
  console.log('[probe] 已带上本机登录态（cookies 字段数:', Object.keys(d.cookies || {}).length, '）');
} catch (e) {
  console.log('[probe] 没读到登录态，按未登录探测');
}
app.setPath('userData', tmp);

require('../main.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 100; i++) {
    const w = BrowserWindow.getAllWindows()[0];
    if (w && w.webContents) {
      try { await w.webContents.executeJavaScript('1'); break; } catch (e) { /* 未就绪 */ }
    }
    await wait(200);
  }
  const win = BrowserWindow.getAllWindows()[0];
  await wait(3000);
  const r = await win.webContents.executeJavaScript(`(async () => {
    const p = await window.api.playurl(${JSON.stringify(BVID)}, ${JSON.stringify(CID)});
    return {
      raw: p.raw,
      sorted: p.tracks.map(t => t.id + ':' + t.kbps),
      flac: p.flac ? (p.flac.kbps + 'kbps / codecs=' + p.flac.codecs) : null,
      dolby: !!p.dolby,
    };
  })()`);
  console.log('[probe] 结果:', JSON.stringify(r));
  const login = await win.webContents.executeJavaScript('window.api.loginState()');
  console.log('[probe] 登录状态:', JSON.stringify({ logged: login.logged, name: login.name || '-' }));
  app.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); app.exit(1); });
