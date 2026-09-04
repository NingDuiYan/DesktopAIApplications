/**
 * 系统托盘：常驻托盘图标 + 原生右键菜单。
 * 配合"关窗隐藏到托盘"策略，应用关闭窗口后仍可通过托盘恢复。
 */
import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { resolveAppIconPath } from './icon'

/** 托盘实例（模块级持有，防止被 GC 回收导致托盘图标消失） */
let tray: Tray | null = null

/**
 * 创建系统托盘。
 *
 * @param getWindow 获取主窗口的函数（用于"显示窗口"菜单项）
 */
export function createTray(getWindow: () => BrowserWindow | null): void {
  const icon = nativeImage.createFromPath(resolveAppIconPath())
  // Windows 托盘图标最佳尺寸 16x16，缩放避免模糊
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('桌面应用')

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => getWindow()?.show() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 标记真正退出，绕过"关窗即隐藏"逻辑
        app.exit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 单击托盘图标也恢复窗口（Windows 常见交互）
  tray.on('click', () => {
    const win = getWindow()
    if (win) {
      win.isVisible() ? win.focus() : win.show()
    }
  })
}