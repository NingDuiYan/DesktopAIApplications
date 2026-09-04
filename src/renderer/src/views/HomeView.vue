<script setup lang="ts">
// 首页：骨架自检页，验证 preload 通道与状态管理可用
import { useAppStore } from '../stores/app'

const appStore = useAppStore()
const electronVersion = ref('')
const isVersionLoading = ref(true)

// 通过 preload 暴露的 window.api 异步请求主进程，验证 IPC 通道（沙箱模式下的标准通信方式）
async function loadElectronVersion(): Promise<void> {
  try {
    electronVersion.value = await window.api.getElectronVersion()
  } catch (error) {
    // 通道异常时给出明确提示，便于排查 preload 配置问题
    electronVersion.value = ''
    console.error('读取 Electron 版本失败:', error)
  } finally {
    isVersionLoading.value = false
  }
}

loadElectronVersion()
</script>

<template>
  <section class="home">
    <h2>{{ appStore.appName }}</h2>
    <p class="slogan">基于 Electron + Vue3 + TypeScript + Element Plus 的桌面应用骨架已就绪</p>
    <div class="meta">
      <el-tag type="success" effect="plain">应用 v0.1.3</el-tag>
      <el-tag v-if="electronVersion" type="info" effect="plain">
        Electron {{ electronVersion }}
      </el-tag>
      <el-tag v-else-if="!isVersionLoading" type="danger" effect="plain">IPC 通道异常</el-tag>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.home {
  padding: 48px 24px;
  text-align: center;

  .slogan {
    margin-top: 12px;
    color: var(--color-text-secondary);
  }

  .meta {
    margin-top: 24px;
  }
}
</style>