/**
 * 自动更新服务：封装 electron-updater，向渲染进程提供检查/下载/安装能力。
 * 更新源为 GitHub Releases；开发模式下 app 未打包，checkForUpdates 会报错，
 * 因此仅在生产环境启用。
 */
import { ipcMain, BrowserWindow } from 'electron'
import { autoUpdater, ProgressInfo } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

/** 更新事件通知给渲染进程的频道前缀 */
const UPDATE_CHANNEL = 'updater:event'

/** 渲染进程可订阅的更新事件类型 */
export type UpdaterEvent =
  | { type: 'checking' } // 正在检查更新
  | { type: 'available'; version: string; notes: string } // 发现新版本
  | { type: 'not-available'; version: string } // 已是最新版本
  | { type: 'progress'; percent: number; transferred: number; total: number } // 下载进度
  | { type: 'downloaded'; version: string } // 下载完成，等待安装
  | { type: 'error'; message: string } // 出错

/** 广播更新事件到所有窗口 */
function broadcast(event: UpdaterEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(UPDATE_CHANNEL, event)
  }
}

/** 初始化 autoUpdater 配置并挂载事件监听 */
function setupAutoUpdater(): void {
  // 允许无签名安装包（个人开发无代码签名证书时必须开启）
  autoUpdater.allowPrerelease = false
  // 下载完成后不自动安装，等用户在 UI 上确认
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcast({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({
      type: 'available',
      version: info.version,
      notes: info.releaseNotes ? String(info.releaseNotes) : ''
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    broadcast({
      type: 'progress',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error) => {
    // 错误信息带回渲染层展示，便于用户反馈问题
    broadcast({ type: 'error', message: error.message })
  })
}

/** 注册更新相关的 IPC 处理器（invoke 型，供 preload 调用） */
function registerUpdaterIpc(): void {
  // 手动检查更新；事件结果通过 updater:event 广播，开发环境直接返回 false 表示不可用
  ipcMain.handle('updater:check', (): boolean => {
    if (!is.dev) {
      autoUpdater.checkForUpdates()
      return true
    }
    return false
  })

  // 用户确认后开始下载
  ipcMain.handle('updater:download', (): void => {
    autoUpdater.downloadUpdate()
  })

  // 退出并安装新版本
  ipcMain.handle('updater:install', (): void => {
    autoUpdater.quitAndInstall()
  })
}

/** 初始化自动更新服务 */
export function initAutoUpdater(): void {
  // 开发模式下 autoUpdater 不可用（应用未打包），但仍注册 IPC 处理器，
  // 让渲染进程的调用能收到明确的 false 而非 "No handler registered" 报错
  registerUpdaterIpc()

  if (is.dev) {
    return
  }

  setupAutoUpdater()

  // 启动后延迟检查，避免与应用初始化抢资源
  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 3000)
}

export { UPDATE_CHANNEL }