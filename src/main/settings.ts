/**
 * 应用设置服务：读写 userData/settings.json，提供内存缓存。
 * 当前仅支持"关窗是否隐藏到托盘"，后续设置项在此扩展。
 */
import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AppSettings {
  /** 关闭窗口时是否隐藏到系统托盘（false 则直接退出应用） */
  closeToTray: boolean
}

/** 默认设置：桌面工具类应用按惯例常驻托盘 */
const DEFAULT_SETTINGS: AppSettings = {
  closeToTray: true
}

let settings: AppSettings = { ...DEFAULT_SETTINGS }

/** 设置文件路径（用户数据目录，卸载不清除该目录） */
function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 应用启动时调用：从磁盘加载设置，文件缺失/损坏时回退默认值 */
export function loadSettings(): void {
  try {
    const raw = readFileSync(settingsFile(), 'utf-8')
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // 首次启动或配置损坏：使用默认值，不阻断启动
    settings = { ...DEFAULT_SETTINGS }
  }
}

/** 读取当前设置（内存） */
export function getSettings(): AppSettings {
  return settings
}

/** 更新设置并落盘；写盘失败保留内存值（设置仍对本会话生效） */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  settings = { ...settings, ...patch }
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (error) {
    console.error('设置写入失败，仅本次会话生效:', error)
  }
  return settings
}