import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 应用全局状态管理 */
export const useAppStore = defineStore('app', () => {
  /** 应用名称 */
  const appName = ref('桌面应用')

  return { appName }
})