const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const B = window.api; // 注意：不能用 const api，会与 contextBridge 暴露的 window.api 冲突
const audio = $('#audio');

const S = {
  view: 'library',
  folders: [],
  active: null,
  cur: -1,
  mode: 'loop', // loop | single | shuffle
  results: [],
  kw: '',
  page: 1,
  hasMore: false,
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => {
  if (!sec || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60), r = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
// 搜索接口给 "4:30" 字符串，视频接口给秒数，统一展示
const fmtDur = (d) => (typeof d === 'number' ? fmt(d) : String(d || ''));
const fmtPlay = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n ?? 0));
const folder = () => S.folders.find((f) => f.id === S.active);
const save = () => B.setLibrary({ folders: S.folders, active: S.active });

let toastTimer;
function toast(msg) {
  const old = $('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

const VIEWS = ['library', 'search', 'diag', 'about'];
function showView(v) {
  if (!VIEWS.includes(v)) v = 'library';
  S.view = v;
  VIEWS.forEach((id) => { const el = $('#view-' + id); if (el) el.hidden = id !== v; });
  $$('.nav-item').forEach((n) => n.classList.toggle('on', n.dataset.view === v));
}

// ---------------------------------------------------------------- 输入识别
// 支持三种输入：关键词 / BV 号、av 号 / B 站链接（含 b23.tv 短链）
function parseInput(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/b23\.tv/i.test(s) || /bilibili\.com/i.test(s) || /^https?:\/\//i.test(s)) {
    return { type: 'url', value: s };
  }
  const bv = s.match(/BV[0-9A-Za-z]{10}/);
  if (bv) return { type: 'bvid', value: bv[0] };
  const av = s.match(/\bav(\d+)\b/i) || s.match(/^(\d{5,})$/);
  if (av) return { type: 'aid', value: av[1] };
  return { type: 'keyword', value: s };
}

// 从最终 URL 里提取视频 id
function idFromUrl(u) {
  const bv = u.match(/BV[0-9A-Za-z]{10}/);
  if (bv) return { type: 'bvid', value: bv[0] };
  const av = u.match(/\/video\/av(\d+)/i) || u.match(/[?&]aid=(\d+)/i);
  if (av) return { type: 'aid', value: av[1] };
  return null;
}

// ---------------------------------------------------------------- 初始化
async function init() {
  const lib = await B.getLibrary();
  if (lib?.folders?.length) {
    S.folders = lib.folders;
    S.active = lib.active && S.folders.some((f) => f.id === lib.active) ? lib.active : S.folders[0].id;
  } else {
    S.folders = [{ id: 'f1', name: '我的歌单', items: [] }];
    S.active = 'f1';
    save();
  }
  audio.volume = 0.8;
  renderFolders();
  renderList();
  checkLogin();
}

const LOGO_SRC = '../assets/icon.png';
let accountState = { logged: false };

async function checkLogin() {
  const av = $('#avatarImg');
  let st;
  try {
    st = await B.loginState();
  } catch (e) {
    st = { logged: false, stale: true };
  }
  if (st.logged) {
    av.onerror = () => { av.onerror = null; av.src = LOGO_SRC; };
    av.src = st.face || LOGO_SRC;
    av.title = (st.name || '已登录') + ' · 点按打开账号菜单';
    accountState = { logged: true, st };
  } else if (st.stale) {
    av.src = LOGO_SRC;
    av.title = '登录状态检查失败 · 点按重试';
    accountState = { logged: false, stale: true };
  } else {
    av.src = LOGO_SRC;
    av.title = '未登录 · 点按登录';
    accountState = { logged: false };
  }
}

// ---------------------------------------------------------------- 账号菜单
const AM_ICONS = {
  update:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>',
  diag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
  about:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>',
  logout:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path></svg>',
  login:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><path d="M3 14h4v4"></path><path d="M10 21h4"></path></svg>',
};

function amItem(icon, label, act, danger) {
  return `<div class="am-item ${danger ? 'danger' : ''}" data-act="${act}">${icon}<span>${label}</span></div>`;
}

function openAccountMenu() {
  const m = $('#accountMenu');
  const head = $('#amHead');
  if (accountState.logged) {
    const st = accountState.st;
    head.innerHTML = `<img src="${esc(st.face || '')}" />
      <div><div class="h-name">${esc(st.name || '已登录')}</div><div class="h-sub">B 站等级 Lv${st.level ?? '-'}</div></div>`;
  } else if (accountState.stale) {
    head.innerHTML = `<img class="logo-avatar" src="${LOGO_SRC}" alt="" />
      <div><div class="h-name">登录状态检查失败</div><div class="h-sub">网络或接口暂时不可用</div></div>`;
  } else {
    head.innerHTML = `<img class="logo-avatar" src="${LOGO_SRC}" alt="" />
      <div><div class="h-name">未登录</div><div class="h-sub">登录后可解锁更高音质</div></div>`;
  }
  const rows = [
    amItem(AM_ICONS.update, '检查更新', 'update'),
    amItem(AM_ICONS.diag, '诊断', 'diag'),
    amItem(AM_ICONS.about, '关于', 'about'),
    '<div class="am-sep"></div>',
    accountState.logged
      ? amItem(AM_ICONS.logout, '退出登录', 'logout', true)
      : amItem(AM_ICONS.login, '扫码登录', 'login'),
  ];
  $('#amItems').innerHTML = rows.join('');
  $('#amItems')
    .querySelectorAll('.am-item')
    .forEach((el) => {
      el.onclick = async () => {
        m.hidden = true;
        const act = el.dataset.act;
        if (act === 'diag' || act === 'about') showView(act);
        else if (act === 'login') openLogin();
        else if (act === 'logout') {
          await B.logout();
          toast('已退出登录');
          checkLogin();
        } else if (act === 'update') {
          showView('about');
          doCheck(false);
        }
      };
    });
  m.hidden = false;
}

// ---------------------------------------------------------------- 渲染
function renderFolders() {
  $('#folders').innerHTML = S.folders
    .map(
      (f) => `<div class="folder ${f.id === S.active ? 'on' : ''}" data-id="${f.id}">
        <span class="name">${esc(f.name)}</span>
        <span><span class="cnt">${f.items.length}</span>${
          S.folders.length > 1 ? `<span class="del" data-del="${f.id}">×</span>` : ''
        }</span></div>`
    )
    .join('');
  $$('#folders .folder').forEach((el) => {
    el.onclick = (e) => {
      const del = e.target.dataset.del;
      if (del) {
        S.folders = S.folders.filter((f) => f.id !== del);
        if (S.active === del) S.active = S.folders[0].id;
        save(); renderFolders(); renderList(); showView('library'); return;
      }
      S.active = el.dataset.id;
      save(); renderFolders(); renderList(); showView('library');
    };
  });
}

function rowHtml(it, i) {
  return `<div class="row ${i === S.cur ? 'on' : ''}" data-i="${i}">
    <img src="${esc(it.cover || '')}" loading="lazy" />
    <div class="meta">
      <div class="t">${esc(it.title)}</div>
      <div class="u">${esc(it.up || it.author || '')} · ${fmtDur(it.duration)}</div>
    </div>
    <div class="acts">
      <button data-play="${i}">播放</button>
      <button data-rm="${i}">移除</button>
    </div></div>`;
}

function renderList() {
  const f = folder();
  $('#libTitle').textContent = f.name;
  $('#libCount').textContent = `${f.items.length} 首`;
  $('#list').innerHTML = f.items.length
    ? f.items.map((it, i) => rowHtml(it, i)).join('')
    : '<div class="empty">这个收藏夹还是空的，去上方搜索框找几首加进来</div>';
  $$('#list .row').forEach((el) => {
    const i = +el.dataset.i;
    el.onclick = (e) => {
      const rm = e.target.dataset.rm;
      if (rm !== undefined) {
        f.items.splice(+rm, 1);
        if (S.cur >= f.items.length) S.cur = -1;
        save(); renderFolders(); renderList(); return;
      }
      if (e.target.dataset.play !== undefined) {
        e.stopPropagation();
        playIndex(+e.target.dataset.play);
        return;
      }
      playIndex(i);
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      const it = f.items[i];
      showCtxMenu(e.clientX, e.clientY, [
        { label: '播放', action: () => playIndex(i) },
        { label: '在浏览器打开 B 站页面', action: () => B.openExternal('https://www.bilibili.com/video/' + it.bvid) },
        { label: '复制视频链接', action: () => { B.copyText('https://www.bilibili.com/video/' + it.bvid); toast('链接已复制'); } },
        { label: '从歌单移除', action: () => { f.items.splice(i, 1); if (S.cur >= f.items.length) S.cur = -1; save(); renderFolders(); renderList(); } },
      ]);
    };
  });
}

function renderResults(append = false) {
  const html = S.results.map((r, i) => {
    const playTxt = r.play != null && r.play !== '' ? ` · ${fmtPlay(r.play)}播放` : '';
    return `<div class="row" data-i="${i}">
      <img src="${r.pic}" loading="lazy" />
      <div class="meta">
        <div class="t">${esc(r.title)}</div>
        <div class="u">${esc(r.author || '')} · ${fmtDur(r.duration)}${playTxt}</div>
      </div>
      <div class="acts">
        <button data-play="${i}">播放</button>
        <button data-add="${i}">加入</button>
      </div></div>`;
  }).join('');
  $('#results').innerHTML = append ? $('#results').innerHTML + html : html;
  $('#moreWrap').hidden = !S.hasMore;
  $$('#results .row').forEach((el) => {
    const i = +el.dataset.i;
    el.onclick = async (e) => {
      if (e.target.dataset.add !== undefined) {
        e.stopPropagation();
        await addToFolder(S.results[i]);
        return;
      }
      await playSearchItem(S.results[i]);
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      const r = S.results[i];
      showCtxMenu(e.clientX, e.clientY, [
        { label: '播放', action: () => playSearchItem(r) },
        { label: '加入收藏夹', action: () => addToFolder(r) },
        { label: '在浏览器打开 B 站页面', action: () => B.openExternal('https://www.bilibili.com/video/' + r.bvid) },
        { label: '复制视频链接', action: () => { B.copyText('https://www.bilibili.com/video/' + r.bvid); toast('链接已复制'); } },
      ]);
    };
  });
}

// ---------------------------------------------------------------- 右键菜单
let ctxEl = null;
function closeCtx() {
  if (ctxEl) { ctxEl.remove(); ctxEl = null; }
}
function showCtxMenu(x, y, items) {
  closeCtx();
  ctxEl = document.createElement('div');
  ctxEl.className = 'ctx';
  ctxEl.innerHTML = items.map((it, i) => `<div class="ctx-item" data-i="${i}">${esc(it.label)}</div>`).join('');
  document.body.appendChild(ctxEl);
  const rect = ctxEl.getBoundingClientRect();
  ctxEl.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
  ctxEl.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
  ctxEl.addEventListener('click', (e) => {
    const i = +e.target.dataset.i;
    if (items[i]) items[i].action();
    closeCtx();
  });
  const onDown = (e) => { if (ctxEl && !ctxEl.contains(e.target)) closeCtx(); };
  window.addEventListener('mousedown', onDown, { once: true });
  window.addEventListener('blur', closeCtx, { once: true });
  window.addEventListener('wheel', closeCtx, { once: true, passive: true });
}

// ---------------------------------------------------------------- 搜索
async function handleSearch() {
  const raw = $('#kw').value.trim();
  if (!raw) return;
  const p = parseInput(raw);
  if (p.type === 'keyword') return doSearch(1);

  showView('search');
  $('#moreWrap').hidden = true;
  $('#results').innerHTML = '<div class="empty">识别到视频链接，解析中…</div>';
  try {
    let id = p;
    if (p.type === 'url') {
      const final = await B.resolve(p.value);
      id = idFromUrl(final);
      if (!id) throw new Error('链接里没有识别到视频 ID');
    }
    const meta = await B.video(id.value);
    S.results = [{
      bvid: meta.bvid,
      title: meta.title,
      author: meta.up,
      pic: meta.cover,
      duration: meta.duration,
      play: meta.play,
    }];
    S.hasMore = false;
    renderResults();
    toast('已识别视频');
  } catch (e) {
    $('#results').innerHTML = `<div class="empty">解析失败：${esc(e.message)}</div>`;
  }
}

async function doSearch(page = 1, append = false) {
  const kw = $('#kw').value.trim();
  if (!kw) return;
  S.kw = kw;
  S.page = page;
  if (!append) {
    $('#results').innerHTML = '<div class="empty">搜索中…</div>';
    showView('search');
  }
  try {
    const r = await B.search(kw, page);
    S.results = append ? S.results.concat(r.list) : r.list;
    S.hasMore = r.hasMore;
    if (!S.results.length) $('#results').innerHTML = '<div class="empty">没有找到结果</div>';
    else renderResults(append);
  } catch (e) {
    $('#results').innerHTML = `<div class="empty">搜索失败：${esc(e.message)}</div>`;
  }
}

async function addToFolder(r) {
  try {
    const meta = await B.video(r.bvid);
    const f = folder();
    if (f.items.some((x) => x.bvid === meta.bvid)) return toast('已经在歌单里了');
    f.items.push({
      bvid: meta.bvid, cid: meta.cid, title: meta.title,
      up: meta.up, cover: meta.cover, duration: meta.duration,
    });
    save(); renderFolders(); renderList();
    toast(`已加入《${f.name}》`);
  } catch (e) {
    toast('加入失败：' + e.message);
  }
}

async function playSearchItem(r) {
  try {
    const meta = await B.video(r.bvid);
    S.cur = -1;
    await playTrack({
      bvid: meta.bvid, cid: meta.cid, title: meta.title,
      up: meta.up, cover: meta.cover, duration: meta.duration,
    });
    renderList();
  } catch (e) {
    toast('播放失败：' + e.message);
  }
}

// ---------------------------------------------------------------- 播放
async function playIndex(i) {
  const f = folder();
  if (i < 0 || i >= f.items.length) return;
  await playTrack(f.items[i], i);
}

async function playTrack(it, idx) {
  try {
    const p = await B.playurl(it.bvid, it.cid);
    let track;
    if (localStorage.prefFlac === '1' && p.flac) track = p.flac;
    else track = p.tracks[0];
    if (idx !== undefined) S.cur = idx;
    audio.src = track.url;
    await audio.play();
    $('#bCover').src = it.cover || '';
    $('#bTitle').textContent = it.title;
    $('#bUp').textContent = it.up || it.author || '';
    $('#quality').textContent = track.kbps ? `${track.kbps}kbps` : '音轨';
    $('#play').textContent = '⏸';
    renderList();
  } catch (e) {
    toast('播放失败：' + e.message);
  }
}

function step(d) {
  const f = folder();
  if (!f.items.length) return;
  let n;
  if (S.mode === 'shuffle') {
    n = Math.floor(Math.random() * f.items.length);
  } else {
    n = S.cur + d;
    if (n >= f.items.length) n = 0;
    if (n < 0) n = f.items.length - 1;
  }
  playIndex(n);
}

// ---------------------------------------------------------------- 登录
let pollTimer;
async function openLogin() {
  $('#loginModal').hidden = false;
  $('#qrTip').textContent = '正在生成二维码…';
  $('#qr').removeAttribute('src');
  let key = null;
  try {
    const r = await B.loginQrcode();
    key = r.key;
    $('#qr').src = r.dataUrl;
    $('#qrTip').textContent = '请使用 B 站 App 扫码';
  } catch (e) {
    $('#qrTip').textContent = '二维码生成失败：' + e.message;
    return;
  }
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const r = await B.loginPoll(key);
      if (r.status === 'scanned') $('#qrTip').textContent = '已扫描，请在手机上确认';
      if (r.status === 'expired') {
        clearInterval(pollTimer);
        $('#qrTip').textContent = '二维码已过期，请关闭后重新打开';
      }
      if (r.status === 'done') {
        clearInterval(pollTimer);
        $('#loginModal').hidden = true;
        toast('登录成功，音质已解锁');
        checkLogin();
      }
    } catch (e) {
      clearInterval(pollTimer);
      $('#qrTip').textContent = '登录检查失败：' + e.message;
    }
  }, 1500);
}

// ---------------------------------------------------------------- 诊断 / 关于
async function initDiag() {
  const env = await B.diagEnv();
  const rows = [
    ['应用版本', `${env.version}${env.logged ? ' · 已登录 B 站' : ' · 未登录'}`],
    ['运行时', `Electron ${env.electron} · Chromium ${env.chrome} · Node ${env.node}`],
    ['系统', `${env.platform} · OS build ${env.os}`],
    ['设备指纹', env.buvid3],
    ['数据目录', env.dataDir],
  ];
  $('#envRows').innerHTML = rows
    .map(([k, v]) => `<div class="row-line">
      <div class="rl-main"><b>${esc(k)}</b></div>
      <span class="muted" style="max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v)}">${esc(v)}</span>
    </div>`)
    .join('');
}

async function runDiag() {
  const bv = $('#diagBv').value.trim();
  if (!bv) return toast('先填一个 BV 号');
  $('#diagSteps').innerHTML = '<div class="diag-ok">测试中…</div>';
  try {
    const r = await B.diagApi(bv);
    $('#diagSteps').innerHTML = r.steps
      .map((s) => `<div class="step ${s.ok ? 'ok' : 'bad'}">
        <span class="mark">${s.ok ? '✓' : '×'}</span>
        <span class="sname">${esc(s.name)}</span>
        <span class="sdetail" title="${esc(s.detail)}">${esc(s.detail)}</span>
        <span class="sms">${s.ms}ms</span></div>`)
      .join('') +
      `<div class="diag-ok ${r.ok ? 'pass' : 'fail'}">${r.ok ? '全链路正常，可以正常播放' : '链路存在异常，参考上方失败步骤'}</div>`;
  } catch (e) {
    $('#diagSteps').innerHTML = `<div class="diag-ok fail">诊断执行失败：${esc(e.message)}</div>`;
  }
}

function renderUpdateBanner(el, r) {
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `<div class="ub-main"><b>发现新版本 ${esc(r.latest)}</b>
      <span class="muted">当前版本 ${esc(r.current)}，前往 GitHub 下载安装包。</span></div>
    <div class="ub-actions"><button class="primary">前往下载</button></div>`;
  el.querySelector('button').onclick = () => B.openExternal(r.url);
}

function hideUpdateBanners() {
  $('#aboutUpdateBanner').hidden = true;
  $('#diagUpdateBanner').hidden = true;
}

function showUpdateMsg(text) {
  $('#updateResult').innerHTML = `<div class="ub-msg">${esc(text)}</div>`;
}

async function doCheck(silent = false) {
  const r = await B.checkUpdate();
  if (!r.ok) {
    if (!silent) showUpdateMsg('检查失败：' + r.error + `\n（仓库：${r.repo}）`);
    return r;
  }
  localStorage.lastCheckAt = new Date().toLocaleString('zh-CN');
  $('#lastCheck').textContent = localStorage.lastCheckAt;
  if (r.hasUpdate) {
    renderUpdateBanner($('#aboutUpdateBanner'), r);
    renderUpdateBanner($('#diagUpdateBanner'), r);
    if (!silent) showUpdateMsg(`发现新版本 v${r.latest}（当前 v${r.current}）\n\n${r.notes || '暂无发布说明'}`);
  } else {
    hideUpdateBanners();
    if (!silent) showUpdateMsg(`当前已是最新版本 v${r.current}`);
  }
  return r;
}

async function initAbout() {
  const env = await B.diagEnv();
  $('#aboutVer').textContent = 'v' + env.version;
  $('#relLink').onclick = () => B.openExternal('https://github.com/' + env.repo + '/releases');
  $('#autoCheck').checked = localStorage.autoCheck !== '0';
}

// ---------------------------------------------------------------- 事件
$$('.nav-item').forEach((el) => { el.onclick = () => showView(el.dataset.view); });

// 标题栏头像 → 二级菜单；点击菜单外自动收起
$('#avatarBtn').onclick = (e) => {
  e.stopPropagation();
  const m = $('#accountMenu');
  if (m.hidden) {
    if (accountState.stale) checkLogin();
    openAccountMenu();
  } else m.hidden = true;
};
document.addEventListener('click', (e) => {
  const m = $('#accountMenu');
  if (!m.hidden && !m.contains(e.target) && !$('#avatarBtn').contains(e.target)) {
    m.hidden = true;
  }
});

// 自绘标题栏的窗口控制
$('#wMin').onclick = () => B.winMin();
$('#wMax').onclick = () => B.winMaxToggle();
$('#wClose').onclick = () => B.winClose();
B.getVersion().then((v) => { $('#sideVer').textContent = 'v' + v; });
$('#diagRun').onclick = runDiag;
$('#diagBv').onkeydown = (e) => { if (e.key === 'Enter') runDiag(); };
$('#openData').onclick = () => B.diagOpenData();
$('#exportDiag').onclick = async () => {
  const f = await B.diagExport();
  toast('已导出到桌面');
};
$('#checkBtn').onclick = () => doCheck(false);
$('#autoCheck').onchange = () => {
  localStorage.autoCheck = $('#autoCheck').checked ? '1' : '0';
  toast($('#autoCheck').checked ? '已开启自动检查' : '已关闭自动检查');
};

$('#go').onclick = handleSearch;
$('#kw').onkeydown = (e) => { if (e.key === 'Enter') handleSearch(); };
$('#more').onclick = () => doSearch(S.page + 1, true);
$('#playAll').onclick = () => playIndex(0);

$('#nfBtn').onclick = () => {
  const n = $('#nfName').value.trim();
  if (!n) return;
  const f = { id: 'f' + Date.now(), name: n, items: [] };
  S.folders.push(f);
  S.active = f.id;
  $('#nfName').value = '';
  save(); renderFolders(); renderList();
};
$('#nfName').onkeydown = (e) => { if (e.key === 'Enter') $('#nfBtn').click(); };

$('#play').onclick = () => {
  if (!audio.src) return step(1);
  audio.paused ? audio.play() : audio.pause();
};
$('#prev').onclick = () => step(-1);
$('#next').onclick = () => step(1);
$('#mode').onclick = () => {
  S.mode = S.mode === 'loop' ? 'single' : S.mode === 'single' ? 'shuffle' : 'loop';
  const label = { loop: '🔁', single: '🔂', shuffle: '🔀' };
  $('#mode').textContent = label[S.mode];
  $('#mode').classList.add('on-mode');
  toast({ loop: '列表循环', single: '单曲循环', shuffle: '随机播放' }[S.mode]);
};

audio.onplay = () => ($('#play').textContent = '⏸');
audio.onpause = () => ($('#play').textContent = '▶');
audio.onended = () => {
  if (S.mode === 'single') {
    audio.currentTime = 0;
    audio.play();
  } else step(1);
};
audio.ontimeupdate = () => {
  if (!audio.duration) return;
  $('#seek').value = String(Math.round((audio.currentTime / audio.duration) * 1000));
  $('#cur').textContent = fmt(audio.currentTime);
  $('#dur').textContent = fmt(audio.duration);
};
$('#seek').oninput = () => {
  if (audio.duration) audio.currentTime = ($('#seek').value / 1000) * audio.duration;
};
$('#vol').oninput = () => (audio.volume = $('#vol').value / 100);
$('#loginClose').onclick = () => {
  clearInterval(pollTimer);
  $('#loginModal').hidden = true;
};
$('#quality').onclick = () => {
  localStorage.prefFlac = localStorage.prefFlac === '1' ? '0' : '1';
  toast(localStorage.prefFlac === '1' ? '已开启无损优先（下一首生效）' : '已关闭无损优先');
};

document.onkeydown = (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    $('#play').click();
  }
};
// 全局右键空白处不弹系统菜单，统一用自定义菜单
window.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.row')) e.preventDefault();
});

// 自检：验证 搜索 → 解析 → 渲染进程直连 CDN（Referer 由主进程注入）整条链路
async function selfTest() {
  const log = (...a) => console.log('[SELFTEST]', ...a);
  try {
    const r = await B.search('周杰伦 晴天', 1);
    log('SEARCH list=' + r.list.length + ' first=' + r.list[0].title);
    const meta = await B.video(r.list[0].bvid);
    log('VIDEO bvid=' + meta.bvid + ' cid=' + meta.cid + ' dur=' + meta.duration);
    const p = await B.playurl(meta.bvid, meta.cid);
    log('PLAYURL tracks=' + p.tracks.map((t) => t.kbps + 'k').join('/') + ' flac=' + !!p.flac);
    const url = p.tracks[0].url;
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
    const res = await new Promise((resolve) => {
      a.addEventListener('loadedmetadata', () => resolve('OK duration=' + a.duration));
      a.addEventListener('error', () => resolve('ERR code=' + (a.error && a.error.code)));
      setTimeout(() => resolve('TIMEOUT'), 20000);
    });
    log('MEDIA ' + res + ' host=' + new URL(url).host);
    const bv = parseInput('https://www.bilibili.com/video/BV1BZbSzZEGT?p=1');
    const bvid2 = parseInput('BV1suam6sEtq');
    const aid = parseInput('av117370366596649');
    const short = idFromUrl('https://www.bilibili.com/video/BV1GJ411x7h7?from=share');
    log('PARSE url=' + bv.value + ' bv=' + bvid2.value + ' aid=' + aid.value + ' fromUrl=' + short.value);
    log(res.startsWith('OK') ? 'RESULT=PASS' : 'RESULT=FAIL');
  } catch (e) {
    log('EXCEPTION ' + e.message);
    log('RESULT=FAIL');
  }
}

init();
async function afterInit() {
  await initDiag();
  await initAbout();
  const lc = localStorage.lastCheckAt;
  if (lc) $('#lastCheck').textContent = lc;
  if (localStorage.autoCheck !== '0') doCheck(true);
}
afterInit();
if (location.search.indexOf('selftest=1') >= 0) setTimeout(selfTest, 1200);
