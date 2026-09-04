<script setup lang="ts">
// 应用根组件：无顶栏，右侧悬浮导航（首页 / 设置）+ 路由出口 + 更新弹窗
import UpdateModal from './components/UpdateModal.vue'
import { HomeFilled, Setting } from '@element-plus/icons-vue'
</script>

<template>
  <div class="app-shell">
    <!-- 右侧悬浮导航栏 -->
    <nav class="float-nav">
      <RouterLink to="/" class="nav-item" title="首页" aria-label="首页">
        <el-icon :size="20"><HomeFilled /></el-icon>
      </RouterLink>
      <RouterLink to="/system" class="nav-item" title="设置" aria-label="设置">
        <el-icon :size="20"><Setting /></el-icon>
      </RouterLink>
    </nav>

    <main class="app-content">
      <RouterView />
    </main>
    <UpdateModal />
  </div>
</template>

<style lang="scss" scoped>
.app-shell {
  height: 100vh;
}

// 右侧悬浮栏：垂直图标组，居中于页面右缘
.float-nav {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition:
      background-color 0.2s,
      color 0.2s;

    &:hover {
      background: var(--color-bg);
      color: var(--color-primary);
    }

    // 当前路由高亮
    &.router-link-active {
      background: var(--color-primary);
      color: #fff;
    }
  }
}
</style>