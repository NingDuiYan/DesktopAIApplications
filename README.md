# 桌面应用（Desktop App）

基于 **Electron 44 + Vue 3** 的 Windows 桌面应用骨架，内置文件操作、系统托盘、系统通知、自动更新等完整系统能力，开箱即用。

## 功能特性

- **无边框窗口**：去掉系统标题栏，页面内自实现最小化 / 最大化 / 关闭按钮与拖拽移动（支持跨屏）
- **系统托盘**：常驻托盘图标，右键菜单（显示窗口 / 退出），单击图标恢复窗口；关窗默认隐藏到托盘（可在设置中关闭）
- **系统通知**：发送原生通知，点击通知唤起主窗口
- **文件操作**：打开 / 保存对话框 + 文件读写，全部在主进程完成，渲染进程无 fs 权限
- **自动更新**：基于 electron-updater + GitHub Releases，支持检查 → 下载（进度条）→ 确认安装的完整流程
- **应用设置**：设置持久化到 `userData/settings.json`，卸载不丢失
- **单实例锁**：整个系统仅允许运行一个实例，重复启动自动唤起已有窗口
- **安全基线**：渲染进程沙箱 + 上下文隔离，禁止 nodeIntegration；仅允许加载本地内容，外部 http(s) 链接交给系统浏览器

## 技术栈

| 分类 | 选型 |
|------|------|
| 框架 | Electron 44、Vue 3.5、TypeScript 5.9 |
| 构建 | electron-vite 5、Vite 7 |
| UI | Element Plus 2.14、SCSS、@element-plus/icons-vue |
| 状态 / 路由 | Pinia 4、Vue Router 5（hash 模式） |
| 打包 / 更新 | electron-builder 26、electron-updater |

## 目录结构

```
├── build/                  # 打包资源（NSIS 安装向导脚本 installer.nsh）
├── resources/              # 应用图标 icon.png（asarUnpack 随包携带）
├── src/
│   ├── main/               # 主进程
│   │   ├── index.ts        # 入口：窗口创建、生命周期、IPC 注册
│   │   ├── file-service.ts # 文件对话框与读写
│   │   ├── tray.ts         # 系统托盘
│   │   ├── updater.ts      # 自动更新
│   │   ├── settings.ts     # 设置持久化
│   │   └── icon.ts         # 图标路径解析
│   ├── preload/            # 预加载脚本：contextBridge 暴露 window.api
│   └── renderer/           # 渲染进程（Vue 应用）
│       └── src/
│           ├── views/      # HomeView（首页）、SystemView（设置）
│           ├── components/ # AppHeader（自绘标题栏）、FloatNav、UpdateModal
│           ├── stores/     # Pinia store
│           └── router/     # hash 路由
├── electron-builder.yml    # 打包配置
└── dist/                   # 构建产物（setup.exe / win-unpacked / latest.yml）
```

## 快速开始

环境要求：Node.js 20+（推荐使用 pnpm），Windows 10/11。

```bash
# 安装依赖
pnpm install

# 若 Electron 二进制下载失败，手动安装（走 npmmirror 镜像）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules/electron/install.js

# 开发模式（热更新）
pnpm dev

# 类型检查
pnpm typecheck
```

## 打包与发布

```bash
# 仅本地打包：生成 dist/desktop-app-<version>-setup.exe（不发布）
pnpm pack

# 打包并发布到 GitHub Releases（需要 GH_TOKEN）
pnpm publish
```

发布要求在环境变量中提供 GitHub Personal Access Token（需该仓库 Releases 读写权限）：

```powershell
$env:GH_TOKEN="your_token_here"
pnpm publish
```

产物说明（`dist/` 目录）：

| 文件 | 说明 |
|------|------|
| `desktop-app-<version>-setup.exe` | NSIS 向导式安装包（可选安装目录、快捷方式） |
| `win-unpacked/desktop-app.exe` | 免安装绿色版 |
| `latest.yml` / `*.blockmap` | 自动更新元数据（增量更新必需，须随 Release 上传） |

## 自动更新机制

- 更新源：GitHub Releases（`electron-builder.yml` 中配置 owner / repo / releaseType）
- 应用启动 3 秒后自动检查；用户也可在设置页手动检查
- 下载完成后不静默安装，由用户确认后退出并安装（`autoInstallOnAppQuit` 兜底）
- 开发模式下自动更新不可用，但 IPC 处理器始终注册，避免渲染侧报错

## 安全架构

| 措施 | 说明 |
|------|------|
| 沙箱 + 上下文隔离 | `sandbox: true`、`contextIsolation: true`，渲染进程无 Node API |
| 单一通信通道 | 所有系统能力经 preload `contextBridge` 暴露的 `window.api` 走 `ipcRenderer.invoke` |
| 导航限制 | 页面仅允许加载本地内容，外部 http(s) 链接转交系统浏览器 |
| 新窗口拦截 | `setWindowOpenHandler` 拒绝一切 window.open，仅白名单协议外开 |
| 最小权限 | 渲染进程无 fs/dialog 能力，文件操作由主进程对话框确认后执行 |

## License

MIT
