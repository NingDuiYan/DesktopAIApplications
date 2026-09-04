import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * 暴露给渲染进程的自定义 API。
 * 渲染进程沙箱化后，preload 中仅可用有限的 electron API（contextBridge/ipcRenderer 等），
 * 所有系统级数据都通过 ipcRenderer.invoke 请求主进程获取，不在渲染侧暴露多余能力。
 */
/** 打开文件并读取内容的返回结构 */
interface FileReadResult {
  path: string
  content: string
}

const api = {
  /** 读取当前 Electron 运行时版本，验证 preload IPC 通道连通性 */
  getElectronVersion: (): Promise<string> => ipcRenderer.invoke('app:get-electron-version'),

  /**
   * 弹出"打开文件"对话框并读取所选文件。
   *
   * @param filterKey 过滤器类型：'text'（文本/MD/JSON）或 'any'（所有文件）
   * @returns 文件路径与内容；用户取消时返回 null
   */
  selectAndReadFile: (filterKey: 'text' | 'any' = 'text'): Promise<FileReadResult | null> =>
    ipcRenderer.invoke('file:select-and-read', filterKey),

  /**
   * 弹出"保存文件"对话框并写入内容。
   *
   * @param options.defaultName 默认文件名
   * @param options.content 写入的文本内容
   * @param options.filterKey 过滤器类型，默认 'text'
   * @returns 保存路径；用户取消时返回 null
   */
  saveFile: (options: {
    defaultName?: string
    content: string
    filterKey?: 'text' | 'any'
  }): Promise<string | null> => ipcRenderer.invoke('file:save', options),

  /**
   * 发送系统通知，点击通知会唤起主窗口。
   *
   * @returns 是否发送成功（系统不支持通知时返回 false）
   */
  showNotification: (options: { title: string; body: string }): Promise<boolean> =>
    ipcRenderer.invoke('notify:show', options),

  /** 手动检查更新（返回 false 表示开发模式不支持） */
  checkForUpdate: (): Promise<boolean> => ipcRenderer.invoke('updater:check'),

  /** 确认后开始下载新版本安装包 */
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updater:download'),

  /** 退出应用并安装已下载的新版本 */
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  /**
   * 订阅主进程广播的更新事件（进度、完成、错误等）。
   * 返回取消订阅函数，避免组件卸载后仍持有监听。
   *
   * @param listener 事件回调，payload 结构见主进程 UpdaterEvent 定义
   * @returns 取消订阅函数
   */
  onUpdateEvent: (listener: (payload: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      listener(payload)
    }
    ipcRenderer.on('updater:event', handler)
    return () => {
      ipcRenderer.removeListener('updater:event', handler)
    }
  },

  /** 窗口控制：最小化 */
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  /** 窗口控制：最大化/还原 */
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  /** 窗口控制：关闭（隐藏到托盘，不是退出） */
  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),
  /** 查询窗口当前是否最大化 */
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  /** 获取窗口当前坐标（屏幕坐标 [x, y]），供自绘标题栏拖动使用 */
  getWindowPosition: (): Promise<[number, number]> => ipcRenderer.invoke('window:get-position'),

  /** 移动窗口到指定屏幕坐标（自绘标题栏拖动时逐帧调用） */
  moveWindow: (x: number, y: number): Promise<void> => ipcRenderer.invoke('window:move', x, y),

  /** 获取应用版本号（package.json version） */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  /** 读取应用设置（关窗是否隐藏到托盘等） */
  getSettings: (): Promise<{ closeToTray: boolean }> => ipcRenderer.invoke('settings:get'),

  /** 更新应用设置并落盘（返回更新后的完整设置） */
  updateSettings: (patch: { closeToTray: boolean }): Promise<{ closeToTray: boolean }> =>
    ipcRenderer.invoke('settings:set', patch),

  /**
   * 订阅窗口最大化状态变化（最大化 ⇄ 还原时回调）。
   *
   * @param listener 回调，参数为是否最大化
   * @returns 取消订阅函数
   */
  onWindowMaximizedChange: (listener: (maximized: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
      listener(maximized)
    }
    ipcRenderer.on('window:maximized-changed', handler)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', handler)
    }
  }
}

// 主进程已强制开启上下文隔离，仅走 contextBridge 安全通道
try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}

export type { FileReadResult }
export type Api = typeof api