# ccMusic

B 站音乐播放程序桌面端。把 B 站视频当歌听：只取视频的**独立音频轨**流式播放，不下载、不转存、不二次分发。

## 它能做什么

- **搜索即播**：全局搜索框支持关键词、BV 号、av 号、B 站链接（含 `b23.tv` 短链）
- **收藏夹分组**：自建多个歌单，往里加歌，按列表顺序自动连播
- **只播声音**：播放的是视频的独立音频轨，不下视频流，62 秒的歌只走约 0.5 MB
- **扫码登录**：登录后可听更高码率音质
- **诊断页**：一键跑通「签名 → 解析 → 取直链 → CDN 可达性」，排查播放问题
- **关于页**：版本信息、GitHub Releases 检查更新

播放模式支持列表循环 / 单曲循环 / 随机，支持进度拖拽、音量调节、空格暂停。

## 安装

到 [Releases](https://github.com/Quinloan/ccMusic/releases) 下载 `ccMusic Setup 1.1.0.exe`，双击安装。Windows 10/11 x64。

## 从源码运行

```bash
npm install
npm start
```

打包安装包：

```bash
npm run dist
```

> 国内网络建议先设置镜像：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
> `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`

## 技术要点

- 用 `session.webRequest` 给媒体请求注入 `Referer`，音频由 Chromium 直连 B 站 CDN，不经过任何本地代理
- B 站接口需 WBI 签名（`img_key`/`sub_key` 排序后 MD5）
- 直链有效期 120 分钟，因此采用「播到哪解析到哪」，只预取下一首
- 数据存在 `userData/radio-data.json`；导出诊断包时登录凭据一律脱敏

## 说明

本项目为个人自用工具，仅做播放与连接，不提供下载、转存或二次分发能力。请遵守 B 站用户协议，不要用于破解会员或批量抓取。

## License

MIT
