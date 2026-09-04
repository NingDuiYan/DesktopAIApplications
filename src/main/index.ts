/**
 * 主进程入口：负责创建应用窗口、控制应用生命周期。
 * 渲染进程的所有系统级能力都通过 preload 暴露的 API 获得，不直接开启 nodeIntegration。
 *
 * 单实例策略：应用关窗后常驻托盘，因此多次启动（尤其 dev 反复执行）会叠加实例。
 * 通过 requestSingleInstanceLock 保证整个系统只有一个实例（一个托盘、一个窗口）。
 */
import { app, shell, BrowserWindow, ipcMain, Notification, nativeImage } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initAutoUpdater } from './updater'
import { registerFileIpc } from './file-service'
import { createTray } from './tray'
import { resolveAppIconPath } from './icon'

// 单实例锁：拿不到锁说明已有实例在运行，直接退出，避免出现多个托盘/窗口
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // 已有实例被再次启动（如用户双击了第二个 exe）时，唤起已有窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 真正退出前设置标志，放行窗口的 close 事件（系统关机/更新安装也会走到这里）
  app.on('before-quit', () => {
    isQuitting = true
  })

  // 托盘常驻：所有窗口关闭后不退出（macOS 逻辑同此），退出仅走托盘菜单
  app.on('window-all-closed', () => {
    // 保留空实现：窗口全部销毁（如内存回收异常）时也维持托盘存活
  })

  app.whenReady().then(() => {
    // Windows 下设置应用用户模型 ID，用于任务栏分组
    electronApp.setAppUserModelId('com.example.desktopapp')

    // 注册 IPC：渲染进程通过 invoke 查询 Electron 版本（沙箱下 preload 无法直接读 process.versions）
    ipcMain.handle('app:get-electron-version', () => process.versions.electron)

    // 文件操作 IPC（打开/保存对话框 + 读写）
    registerFileIpc()

    // 系统通知：点击通知时聚焦主窗口
    ipcMain.handle(
      'notify:show',
      (_event, options: { title: string; body: string }): boolean => {
        if (!Notification.isSupported()) {
          return false
        }
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: nativeImage.createFromPath(resolveAppIconPath())
        })
        notification.on('click', () => mainWindow?.show())
        notification.show()
        return true
      }
    )

    // 初始化自动更新服务（仅生产环境生效，更新源 GitHub Releases）
    initAutoUpdater()

    // 开发模式下按 F12 打开/关闭 DevTools，忽略 CmdOrCtrl+R 等快捷键
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()
    createTray(() => mainWindow)

    // macOS 上点击 Dock 图标且无窗口时重新创建窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

/** 允许在系统浏览器打开的协议白名单 */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

/** 判断 URL 是否为允许外开的 http/https 链接 */
function isSafeExternalUrl(url: string): boolean {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    // 非法 URL 一律拒绝
    return false
  }
}

/** 主窗口引用（供托盘菜单恢复窗口使用） */
let mainWindow: BrowserWindow | null = null

/** 是否真正退出应用（区分"关窗隐藏到托盘"与"退出"） */
let isQuitting = false

/** 创建主窗口 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: '桌面应用',
    icon: nativeImage.createFromPath(resolveAppIconPath()),
    // 安全基线：开启沙箱与上下文隔离，关闭 node/webview，仅通过 contextBridge 暴露 IPC API
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false
    }
  })

  // 渲染完成后再显示窗口，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 关闭窗口 = 隐藏到托盘（常驻），真正退出走托盘菜单"退出"
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // 阻止页面内导航跳转到外部源（渲染进程只允许加载本地内容）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isSafeExternalUrl(url)) {
      event.preventDefault()
    } else if (mainWindow?.webContents.getURL() !== url) {
      // 外部地址交给系统浏览器，页面本身不跳转
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // 拦截新窗口：仅 http/https 链接可交给系统浏览器，其余（javascript: 等）直接拒绝
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // 开发模式加载 Vite dev server，生产模式加载打包后的 HTML
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}