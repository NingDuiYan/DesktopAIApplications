# 桌面应用（Desktop App）

基于 **Electron 44 + Vue 3** 的 Windows 桌面应用骨架，内置无边框窗口、系统托盘、系统通知、文件操作、自动更新等完整系统能力，开箱即用。

> 当前版本：v0.1.4 ｜ 更新源：GitHub Releases（NingDuiYan/DesktopAIApplications）

## 功能特性

- **无边框自绘窗口**：`frame: false` 去掉系统标题栏；不使用 `-webkit-app-region: drag`（光标固定无法自定义），改为指针捕获 + IPC 移动窗口，支持跨屏拖动与自定义 grab 光标
- **悬浮导航**：可拖动、自动吸附左右边缘；5 秒无交互收缩为小图标；区分轻点跳转路由与拖动（超过阈值不误触跳转）
- **系统托盘**：常驻托盘，右键菜单（显示窗口 / 退出），单击恢复窗口；关窗行为可在设置中切换（默认隐藏到托盘常驻）
- **系统通知**：原生通知，点击通知唤起主窗口
- **文件操作**：打开 / 保存对话框 + 文本读写，全部在主进程完成，渲染进程无 fs 权限
- **自动更新**：electron-updater + GitHub Releases 完整流程（检查 → 版本对比弹窗 → 下载进度 → 确认重启安装）；检查失败时兜底拉取最新 release 版本号，角标可点击跳转手动下载
- **应用设置**：持久化到 `userData/settings.json`，写盘失败仍对本会话生效，卸载不丢数据
- **安装向导**：NSIS 自定义深色主题（深蓝底白字），安装过程中可自选安装目录、勾选桌面 / 开始菜单快捷方式
- **单实例锁**：全系统仅一个实例，重复启动自动唤起已有窗口

## 技术栈

| 分类 | 选型 |
|------|------|
| 框架 | Electron 44、Vue 3.5、TypeScript 5.9 |
| 构建 | electron-vite 5、Vite 7 |
| UI | Element Plus 2.14（按需自动引入）、SCSS、@element-plus/icons-vue |
| 状态 / 路由 | Pinia 4、Vue Router 5（hash 模式，适配 file:// 协议） |
| 打包 / 更新 | electron-builder 26、electron-updater 6.8 |

## 目录结构

```
├── build/
│   └── installer.nsh       # NSIS 自定义脚本：深色主题 + 快捷方式选项页
├── resources/
│   └── icon.png            # 应用图标（窗口/托盘/通知共用，asarUnpack 随包携带）
├── src/
│   ├── main/               # 主进程
│   │   ├── index.ts        # 入口：窗口/生命周期/IPC 注册/单实例锁/导航拦截
│   │   ├── file-service.ts # 文件对话框与读写（file:select-and-read / file:save）
│   │   ├── tray.ts         # 系统托盘
│   │   ├── updater.ts      # 自动更新（事件广播 updater:event）
│   │   ├── settings.ts     # 设置持久化（settings:get / settings:set）
│   │   └── icon.ts         # 图标路径解析（dev/打包双环境）
│   ├── preload/
│   │   ├── index.ts        # contextBridge 暴露 window.api（invoke 型 IPC）
│   │   └── index.d.ts      # window.api 与 UpdaterEvent 类型声明
│   └── renderer/src/
│       ├── App.vue         # 根组件：挂载时自动检查一次更新
│       ├── components/
│       │   ├── AppHeader.vue   # 自绘标题栏：拖拽移动 + 最小化/最大化/关闭
│       │   ├── FloatNav.vue    # 悬浮导航：拖动吸边/闲置收缩/路由跳转
│       │   └── UpdateModal.vue # 更新弹窗：版本对比/下载进度/安装引导
│       ├── views/
│       │   ├── HomeView.vue    # 首页（占位）
│       │   └── SystemView.vue  # 设置页：版本角标 + 关闭行为
│       ├── stores/app.ts   # Pinia 全局状态
│       └── router/index.ts # hash 路由（/ 与 /system）
├── electron-builder.yml    # 打包配置（NSIS 向导式 + GitHub 发布源）
├── electron.vite.config.ts # 三端构建配置（自动导入/主题注入/别名）
└── dist/                   # 构建产物
```

## 快速开始

环境要求：Node.js 20+（推荐 pnpm）、Windows 10/11。

```bash
# 安装依赖
pnpm install

# 开发模式（热更新）
pnpm dev

# 类型检查（node + web 双 tsconfig）
pnpm typecheck
```

若 Electron 二进制下载失败，用镜像手动安装：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules/electron/install.js
```

## 打包与发布

```bash
# 仅本地打包：bump patch 版本 + 构建 setup.exe（不发布）
pnpm pack

# 打包并发布到 GitHub Releases
pnpm publish
```

发布需提供 GitHub Personal Access Token（需该仓库 Releases 读写权限）：

```powershell
$env:GH_TOKEN="your_token_here"
pnpm publish
```

产物说明（`dist/` 目录）：

| 文件 | 说明 |
|------|------|
| `desktop-app-<version>-setup.exe` | NSIS 向导式安装包 |
| `win-unpacked/desktop-app.exe` | 免安装绿色版 |
| `latest.yml` / `*.blockmap` | 自动更新元数据，须随 Release 上传（增量更新必需） |

> 注意：electron-builder 并行上传存在竞态，若 Release 创建后中断，重跑 `pnpm publish` 前先确认版本号是否已 bump，避免生成无效的重复版本。

## IPC 通道一览

| 通道 | 方向 | 说明 |
|------|------|------|
| `app:get-version` / `app:get-electron-version` | R → M | 版本查询 |
| `settings:get` / `settings:set` | R → M | 设置读写（userData/settings.json） |
| `file:select-and-read` / `file:save` | R → M | 文件对话框 + 读写 |
| `notify:show` | R → M | 系统通知（点击唤起窗口） |
| `window:minimize/maximize/close/is-maximized` | R → M | 窗口控制 |
| `window:get-position` / `window:move` | R → M | 自绘标题栏拖动 |
| `updater:check/download/install` | R → M | 更新流程 |
| `updater:event` | M → R | 更新状态广播（checking/available/progress/downloaded/error） |
| `window:maximized-changed` | M → R | 最大化状态变化推送 |

## 安全架构

| 措施 | 说明 |
|------|------|
| 沙箱 + 上下文隔离 | `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false` |
| 单一通信通道 | 所有系统能力经 preload `contextBridge` 暴露的 `window.api`，统一 `invoke` 模式 |
| 导航限制 | 渲染进程仅允许加载本地内容；外部 http(s) 链接经协议白名单校验后交给系统浏览器 |
| 新窗口拦截 | `setWindowOpenHandler` 拒绝一切 window.open，仅白名单协议外开 |
| 最小权限 | 渲染进程无 fs/dialog 能力，文件操作经主进程对话框确认后执行 |

## 已知注意事项

- 未做代码签名，安装包首次运行会触发 Windows SmartScreen「未知发布者」警告
- 自动更新在开发模式不可用（应用未打包），但 IPC 处理器始终注册，渲染侧不会报错
- macOS 的 dmg/zip 目标仅能在 macOS 环境构建
- 关窗默认隐藏到托盘，真正退出需通过托盘菜单「退出」

## License

MIT
