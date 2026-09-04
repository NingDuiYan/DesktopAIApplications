/**
 * 应用图标路径解析（主进程）。
 * 开发模式取项目根 resources/；生产模式取 asar 解包目录，
 * 因为 electron-builder 配置了 asarUnpack: resources/**，
 * 打包后图标位于 <安装目录>\resources\app.asar.unpacked\resources\。
 */
import { app } from 'electron'
import { join } from 'node:path'

/** 解析应用图标绝对路径（窗口/通知/托盘共用） */
export function resolveAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icon.png')
    : join(__dirname, '../../resources/icon.png')
}