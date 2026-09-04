<script setup lang="ts">
// 顶部标题栏组件：无边框窗口下作为窗口拖拽区，右侧提供最小化/最大化/关闭控件。
// 不使用 -webkit-app-region: drag（该区域光标由系统固定为箭头，无法自定义），
// 改为指针捕获 + IPC 移动窗口，从而可自定义 grab 光标
import { useAppStore } from "../stores/app";

const appStore = useAppStore();

/** 窗口是否处于最大化状态（用于切换"最大化/还原"图标） */
const isMaximized = ref(false);
/** 是否处于拖拽移动窗口状态（用于切换光标与禁选文本） */
const isMoving = ref(false);

const titleRegionRef = ref<HTMLElement | null>(null);
/** 拖动起点：按下时的窗口坐标与指针屏幕坐标 */
let moveStart: {
  winX: number;
  winY: number;
  pointerX: number;
  pointerY: number;
} | null = null;

// 模板不允许直接访问 window（Vue 全局白名单未包含），统一在 script 中包装成函数
const windowMinimize = (): Promise<void> => window.api.windowMinimize();
const windowMaximize = (): Promise<void> => window.api.windowMaximize();
const windowClose = (): Promise<void> => window.api.windowClose();

/** 按下标题区域：记录起点并捕获指针，开始拖动窗口 */
function onTitlePointerdown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const region = titleRegionRef.value;
  if (!region) return;
  const target = e.target as HTMLElement;
  // 窗口控制按钮区域不参与拖动（按钮点击优先）
  if (target.closest(".window-controls")) return;
  window.api.getWindowPosition().then(([winX, winY]) => {
    moveStart = { winX, winY, pointerX: e.screenX, pointerY: e.screenY };
    isMoving.value = true;
    region.setPointerCapture(e.pointerId);
  });
}

/** 拖动中：基于起点 + 指针位移计算窗口新位置（跨屏幕一致） */
function onTitlePointermove(e: PointerEvent): void {
  if (!moveStart) return;
  const dx = e.screenX - moveStart.pointerX;
  const dy = e.screenY - moveStart.pointerY;
  window.api.moveWindow(moveStart.winX + dx, moveStart.winY + dy);
}

/** 结束拖动（含捕获丢失兜底，如拖出窗口后松开） */
function onTitlePointerEnd(): void {
  moveStart = null;
  isMoving.value = false;
}

// 初始化：查询当前最大化状态，并订阅后续变化
onMounted(() => {
  window.api.windowIsMaximized().then((v) => (isMaximized.value = v));
  window.api.onWindowMaximizedChange((v) => (isMaximized.value = v));
});
</script>

<template>
  <!-- 顶部 header：兼作标题栏，标题区域按下拖动移动窗口 -->
  <header class="app-header">
    <div
      ref="titleRegionRef"
      class="title-region"
      :class="{ 'is-moving': isMoving }"
      @dblclick="windowMaximize()"
      @pointerdown="onTitlePointerdown"
      @pointermove="onTitlePointermove"
      @pointerup="onTitlePointerEnd"
      @pointercancel="onTitlePointerEnd"
      @lostpointercapture="onTitlePointerEnd"
    >
      <h1 class="app-title">{{ appStore.appName }}</h1>
    </div>
    <!-- 窗口控制按钮组 -->
    <div class="window-controls">
      <button
        class="wc-btn"
        title="最小化"
        aria-label="最小化"
        @click="windowMinimize()"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>
      <button
        class="wc-btn"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? '还原' : '最大化'"
        @click="windowMaximize()"
      >
        <svg
          v-if="isMaximized"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <!-- 还原：后层方框 + 前层小方框 -->
          <path
            d="M3 3h5v5h-5z"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
          <path
            d="M2 7V2h5"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
        </svg>
        <svg
          v-else
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <!-- 最大化：空心方框 -->
          <rect
            x="0.5"
            y="0.5"
            width="9"
            height="9"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
        </svg>
      </button>
      <button
        class="wc-btn wc-close"
        title="关闭"
        aria-label="关闭"
        @click="windowClose()"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M0 0l10 10M10 0L0 10"
            stroke="currentColor"
            stroke-width="1"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
// 顶部 header：兼作窗口标题栏；本身非拖拽区，避免 drag 拦截按钮点击
.app-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 48px;
  padding: 0 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);

  // 标题区域：按下拖动移动窗口（IPC 实现），grab 光标提示可拖动
  .title-region {
    display: flex;
    align-items: center;
    flex: 1;
    height: 100%;
    cursor: grab;
    user-select: none;

    // 拖动中：切换为按压光标，防止拖动时选中文本
    &.is-moving {
      cursor: grabbing;
    }

    .app-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
  }

  // 窗口控制按钮组：完全不处于拖拽父子关系中，点击事件不会被拦截
  .window-controls {
    display: flex;
    align-items: center;
    height: 100%;

    .wc-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 46px;
      height: 100%;
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition:
        background-color 0.15s,
        color 0.15s;

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: var(--color-text-primary);
      }
    }

    // 关闭按钮 hover 使用 Windows 惯例红色
    .wc-close:hover {
      background: #e81123;
      color: #fff;
    }
  }
}
</style>
