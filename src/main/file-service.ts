/**
 * 文件操作服务：系统对话框（打开/保存）+ 文件读写。
 * 渲染进程沙箱化后没有 fs/dialog 能力，统一通过 IPC 在主进程完成。
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'

/** 常用文件类型过滤器（渲染进程按需传 key 引用，避免在 IPC 中传大对象） */
const FILE_FILTERS: Record<string, Electron.FileFilter[]> = {
  text: [{ name: '文本文件', extensions: ['txt', 'md', 'json', 'log'] }],
  any: [{ name: '所有文件', extensions: ['*'] }]
}

/** 弹出"打开文件"对话框并读取所选文件内容 */
async function selectAndReadFile(
  event: Electron.IpcMainInvokeEvent,
  filterKey: string
): Promise<{ path: string; content: string } | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: '打开文件',
    properties: ['openFile'],
    filters: FILE_FILTERS[filterKey] ?? FILE_FILTERS.any
  })
  // 用户取消时返回 null，渲染侧据此区分"取消"与"失败"
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const path = result.filePaths[0]
  const content = await readFile(path, 'utf-8')
  return { path, content }
}

/** 弹出"保存文件"对话框并将内容写入所选位置 */
async function saveFile(
  event: Electron.IpcMainInvokeEvent,
  options: { defaultName?: string; content: string; filterKey?: string }
): Promise<string | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(win!, {
    title: '保存文件',
    defaultPath: options.defaultName,
    filters: FILE_FILTERS[options.filterKey ?? 'text']
  })
  if (result.canceled || !result.filePath) {
    return null
  }
  await writeFile(result.filePath, options.content, 'utf-8')
  return result.filePath
}

/** 注册文件操作 IPC 处理器 */
export function registerFileIpc(): void {
  ipcMain.handle('file:select-and-read', (event, filterKey: string) =>
    selectAndReadFile(event, filterKey)
  )
  ipcMain.handle(
    'file:save',
    (event, options: { defaultName?: string; content: string; filterKey?: string }) =>
      saveFile(event, options)
  )
}