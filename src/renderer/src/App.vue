<script setup lang="ts">
// 应用根组件：组合顶部标题栏、悬浮导航、路由出口与更新弹窗
import AppHeader from './components/AppHeader.vue'
import FloatNav from './components/FloatNav.vue'
import UpdateModal from './components/UpdateModal.vue'

onMounted(() => {
  // 进入应用时自动检查一次版本更新（结果经 updater 事件广播，
  // 由 UpdateModal 与设置页角标各自消费；dev 模式下返回 false，无需处理）
  window.api.checkForUpdate().catch(() => {})
})
</script>

<template>
  <div class="app-shell">
    <!-- 顶部标题栏（拖拽 + 窗口控制），具体逻辑见 AppHeader.vue -->
    <AppHeader />

    <!-- 悬浮导航（拖动吸边 + 闲置收缩），具体逻辑见 FloatNav.vue -->
    <FloatNav />

    <main class="app-content">
      <RouterView />
    </main>

    <UpdateModal />
  </div>
</template>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

// 内容区：占据 header 之外的剩余高度，滚动只发生在内容区内部
.app-content {
  flex: 1;
  overflow: auto;
}
</style>