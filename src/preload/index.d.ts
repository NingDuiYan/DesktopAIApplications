import { ElectronAPI } from '@electron-toolkit/preload'

/** 主进程广播的更新事件（与 src/main/updater.ts 中 UpdaterEvent 保持一致） */
export interface UpdaterEvent {
  type: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error'
  /** available/downloaded/not-available：版本号 */
  version?: string
  /** available：更新说明 */
  notes?: string
  /** progress：下载百分比 0-100 */
  percent?: number
  /** progress：已下载字节数 */
  transferred?: number
  /** progress：总字节数 */
  total?: number
  /** error：错误信息 */
  message?: string
}

/** 打开文件并读取内容的返回结构 */
export interface FileReadResult {
  path: string
  content: string
}

/** 渲染进程全局类型声明：window.electron / window.api */
declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      /** 读取当前 Electron 运行时版本 */
      getElectronVersion: () => Promise<string>
      /** 弹出打开对话框并读取文件；取消返回 null */
      selectAndReadFile: (filterKey?: 'text' | 'any') => Promise<FileReadResult | null>
      /** 弹出保存对话框并写入内容；取消返回 null */
      saveFile: (options: {
        defaultName?: string
        content: string
        filterKey?: 'text' | 'any'
      }) => Promise<string | null>
      /** 发送系统通知，点击通知唤起主窗口 */
      showNotification: (options: { title: string; body: string }) => Promise<boolean>
      /** 手动检查更新（返回 false 表示开发模式不支持） */
      checkForUpdate: () => Promise<boolean>
      /** 确认后开始下载新版本安装包 */
      downloadUpdate: () => Promise<void>
      /** 退出应用并安装已下载的新版本 */
      installUpdate: () => Promise<void>
      /** 订阅更新事件，返回取消订阅函数 */
      onUpdateEvent: (listener: (payload: UpdaterEvent) => void) => () => void
      /** 窗口控制：最小化 */
      windowMinimize: () => Promise<void>
      /** 窗口控制：最大化/还原 */
      windowMaximize: () => Promise<void>
      /** 窗口控制：关闭（隐藏到托盘，不是退出） */
      windowClose: () => Promise<void>
      /** 查询窗口当前是否最大化 */
      windowIsMaximized: () => Promise<boolean>
      /** 获取窗口当前坐标（屏幕坐标 [x, y]） */
      getWindowPosition: () => Promise<[number, number]>
      /** 移动窗口到指定屏幕坐标（自绘标题栏拖动） */
      moveWindow: (x: number, y: number) => Promise<void>
      /** 获取应用版本号（package.json version） */
      getAppVersion: () => Promise<string>
      /** 读取应用设置（关窗是否隐藏到托盘等） */
      getSettings: () => Promise<{ closeToTray: boolean }>
      /** 更新应用设置并落盘（返回更新后的完整设置） */
      updateSettings: (patch: { closeToTray: boolean }) => Promise<{ closeToTray: boolean }>
      /** 订阅窗口最大化状态变化，返回取消订阅函数 */
      onWindowMaximizedChange: (listener: (maximized: boolean) => void) => () => void
    }
  }
}

export {}