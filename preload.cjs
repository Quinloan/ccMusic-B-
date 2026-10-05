const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 收藏夹数据
  getLibrary: () => ipcRenderer.invoke('store:get'),
  setLibrary: (lib) => ipcRenderer.invoke('store:set', lib),

  // B 站
  search: (keyword, page) => ipcRenderer.invoke('bili:search', keyword, page),
  video: (id) => ipcRenderer.invoke('bili:video', id),
  playurl: (bvid, cid) => ipcRenderer.invoke('bili:playurl', bvid, cid),
  resolve: (url) => ipcRenderer.invoke('bili:resolve', url),

  // 系统
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  copyText: (text) => ipcRenderer.invoke('app:copyText', text),

  // 诊断 / 关于 / 更新
  diagEnv: () => ipcRenderer.invoke('diag:env'),
  diagApi: (bv) => ipcRenderer.invoke('diag:api', bv),
  diagOpenData: () => ipcRenderer.invoke('diag:openData'),
  diagExport: () => ipcRenderer.invoke('diag:export'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  getVersion: () => ipcRenderer.invoke('app:version'),

  // 登录
  loginState: () => ipcRenderer.invoke('login:state'),
  loginQrcode: () => ipcRenderer.invoke('login:qrcode'),
  loginPoll: (key) => ipcRenderer.invoke('login:poll', key),
  logout: () => ipcRenderer.invoke('login:logout'),
});
