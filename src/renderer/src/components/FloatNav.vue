<script setup lang="ts">
// 悬浮导航组件：可自由拖动吸附左右边缘、闲置收缩为小图标；
// 图标轻点跳转路由，按住拖动超过阈值则视为拖动（不误触跳转）
import { HomeFilled, Setting } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";

// 顶部标题栏高度：导航 y 方向硬边界，避免遮挡顶部
const HEADER_HEIGHT = 48;

const router = useRouter();

const navRef = ref<HTMLElement | null>(null);
/** 导航 fixed 定位（left/top 由拖动与吸边逻辑控制） */
const navStyle = reactive({ left: "0px", top: "0px" });

// 导航内容固定：2 个 40px 图标 + 上下 padding 16 + 中间 gap 8 => 高 104px；宽 40 + padding 16 => 56px
// 初始位置：右边缘 16px、垂直居中（setup 阶段直接计算，不依赖挂载时序，杜绝首帧位置不准确）
navStyle.left = `${window.innerWidth - 56 - 16}px`;
navStyle.top = `${(window.innerHeight - 104) / 2}px`;
const isDragging = ref(false);
const isCollapsed = ref(false);
/** 导航当前是否有鼠标悬停（悬停时不触发闲置收缩） */
const navHovering = ref(false);
/** 当前吸附的侧边（初始为右），窗口缩放时据此保持贴边 */
let snappedSide: "left" | "right" | null = "right";
/** 本次按下到当前位置的位移是否超过拖动阈值 */
let hasMoved = false;
let suppressClick = false;
/** pointerdown 按下时命中的导航项路由（click 的 target 会被指针捕获重定向，故提前记录） */
let pressedRoute: string | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let pressX = 0;
let pressY = 0;
let idleTimer: number | undefined;
/** 展开后重新吸边的延迟计时（与闲置计时无关） */
let expandSnapTimer: number | undefined;

/** 清理闲置计时器 */
function clearIdleTimer(): void {
  if (idleTimer !== undefined) window.clearTimeout(idleTimer);
  idleTimer = undefined;
}

/** 重置闲置计时器：5 秒无交互后收缩为小图标并吸附边缘（拖动/悬停中不收缩） */
function resetIdleTimer(): void {
  clearIdleTimer();
  idleTimer = window.setTimeout(() => {
    if (!isDragging.value && !navHovering.value) {
      isCollapsed.value = true;
      // 等 DOM 应用收缩样式后按新尺寸吸边，保证贴边
      requestAnimationFrame(() => snapToEdge());
    }
  }, 5000);
}

/** 水平吸附到最近的左右边缘（8px 边距），垂直位置保留且不低于 header 高度 */
function snapToEdge(): void {
  const nav = navRef.value;
  if (!nav) return;
  const x = parseFloat(navStyle.left);
  const distLeft = x;
  const distRight = window.innerWidth - x - nav.offsetWidth;
  const y = Math.min(
    Math.max(parseFloat(navStyle.top), HEADER_HEIGHT + 8),
    window.innerHeight - nav.offsetHeight - 8,
  );
  const toLeft = distLeft <= distRight;
  snappedSide = toLeft ? "left" : "right";
  navStyle.left = `${toLeft ? 8 : window.innerWidth - nav.offsetWidth - 8}px`;
  navStyle.top = `${y}px`;
}

/** 窗口缩放时重定位：保持当前吸附侧贴边，中间位置则 clamp 进视口，垂直方向同样不越界 */
function relocateOnResize(): void {
  const nav = navRef.value;
  if (!nav) return;
  const y = Math.min(
    Math.max(parseFloat(navStyle.top) || HEADER_HEIGHT + 8, HEADER_HEIGHT + 8),
    window.innerHeight - nav.offsetHeight - 8,
  );
  let x: number;
  if (snappedSide === "right") {
    x = window.innerWidth - nav.offsetWidth - 8;
  } else if (snappedSide === "left") {
    x = 8;
  } else {
    // 中间未吸附：仅保证不越出左右边界
    x = Math.min(
      Math.max(parseFloat(navStyle.left) || 0, 0),
      window.innerWidth - nav.offsetWidth,
    );
  }
  navStyle.left = `${x}px`;
  navStyle.top = `${y}px`;
}

/**
 * 按下导航任意位置：记录起点并捕获指针；
 * 位移未超阈值视为"点击"，超过则视为"拖动"，可拖出窗口不丢事件
 */
function onNavPointerdown(e: PointerEvent): void {
  if (e.button !== 0) return;
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  isDragging.value = true;
  clearIdleTimer();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  pressX = e.clientX;
  pressY = e.clientY;
  hasMoved = false;
  suppressClick = false;
  // 按下时真实命中目标仍是图标元素（捕获重定向只影响后续事件），记录其目标路由
  pressedRoute =
    (e.target as HTMLElement)
      .closest(".nav-item")
      ?.getAttribute("data-route") ?? null;
  // 指针捕获：后续 pointermove/pointerup 持续投递到导航元素
  target.setPointerCapture(e.pointerId);
}

/** 拖动中：位移未达阈值不移动（防误拖），到达后跟手并 clamp 在视口（顶部避开 header） */
function onNavPointermove(e: PointerEvent): void {
  const nav = navRef.value;
  if (!nav || !isDragging.value) return;
  // 未达阈值且位移小于 4px：视为待定点击，不触发移动
  if (!hasMoved && Math.hypot(e.clientX - pressX, e.clientY - pressY) < 4)
    return;
  hasMoved = true;
  const x = Math.min(
    Math.max(e.clientX - dragOffsetX, 0),
    window.innerWidth - nav.offsetWidth,
  );
  const y = Math.min(
    Math.max(e.clientY - dragOffsetY, HEADER_HEIGHT + 8),
    window.innerHeight - nav.offsetHeight - 8,
  );
  navStyle.left = `${x}px`;
  navStyle.top = `${y}px`;
}

/** 松开：拖动过则吸边并抑制随后的 click（防误触路由）；未移动=点击，放行 */
function onNavPointerup(): void {
  if (!isDragging.value) return;
  suppressClick = hasMoved;
  if (hasMoved) snapToEdge();
  hasMoved = false;
  isDragging.value = false;
  resetIdleTimer();
}

/** 指针捕获丢失兜底：鼠标在窗口外松开等场景，保证一定结束拖动并吸边 */
function onNavLostPointerCapture(): void {
  if (!isDragging.value) return;
  hasMoved = false;
  isDragging.value = false;
  snapToEdge();
  resetIdleTimer();
}

/**
 * 点击导航跳转路由。
 * 指针捕获会将 click 的 target 重定向为导航本身，故使用 pointerdown 记录的路由；
 * 拖动(位移超阈值)已由 suppressClick 标记，纯点击才执行跳转
 */
function handleNavClick(): void {
  if (suppressClick) {
    suppressClick = false;
    pressedRoute = null;
    return;
  }
  if (pressedRoute) router.push(pressedRoute);
  pressedRoute = null;
}

/** 鼠标移入：立即展开并暂停闲置计时，动画结束后按最终尺寸重新吸边，避免贴边只露出部分 */
function handleNavEnter(): void {
  navHovering.value = true;
  isCollapsed.value = false;
  clearIdleTimer();
  if (expandSnapTimer !== undefined) window.clearTimeout(expandSnapTimer);
  expandSnapTimer = window.setTimeout(() => {
    expandSnapTimer = undefined;
    if (!isCollapsed.value) snapToEdge();
  }, 280);
}

/** 鼠标移出：重新开始闲置计时 */
function handleNavLeave(): void {
  navHovering.value = false;
  resetIdleTimer();
}

// 初始化：启动闲置收缩计时，监听窗口缩放以自适应位置（初始位置已在 setup 阶段确定）
onMounted(() => {
  resetIdleTimer();
  window.addEventListener("resize", relocateOnResize);
});

onUnmounted(() => {
  clearIdleTimer();
  window.removeEventListener("resize", relocateOnResize);
  if (expandSnapTimer !== undefined) window.clearTimeout(expandSnapTimer);
});
</script>

<template>
  <!-- 悬浮导航：整体可拖，位移阈值区分点击/拖动；闲置收缩为小图标并吸附边缘 -->
  <nav
    ref="navRef"
    class="float-nav"
    :class="{ 'is-dragging': isDragging, 'is-collapsed': isCollapsed }"
    :style="navStyle"
    @click="handleNavClick"
    @pointerdown="onNavPointerdown"
    @pointermove="onNavPointermove"
    @pointerup="onNavPointerup"
    @lostpointercapture="onNavLostPointerCapture"
    @mouseenter="handleNavEnter"
    @mouseleave="handleNavLeave"
  >
    <RouterLink
      to="/"
      data-route="/"
      class="nav-item"
      title="首页"
      aria-label="首页"
    >
      <el-icon :size="20"><HomeFilled /></el-icon>
    </RouterLink>
    <RouterLink
      to="/system"
      data-route="/system"
      class="nav-item"
      title="设置"
      aria-label="设置"
    >
      <el-icon :size="20"><Setting /></el-icon>
    </RouterLink>
  </nav>
</template>

<style lang="scss" scoped>
// 悬浮导航：fixed 定位由 navStyle 控制，整体可拖动吸边，图标轻点跳转路由
.float-nav {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
  cursor: grab;

  // left/top 参与过渡：松手吸边/展开吸边时产生平滑滑移动画
  transition:
    padding 0.25s,
    gap 0.25s,
    left 0.2s,
    top 0.2s;

  // 按下拖动中：禁用过渡避免跟手延迟
  &.is-dragging {
    cursor: grabbing;
    transition: none;
    user-select: none;
  }

  // 闲置收缩：仅留一个竖条小图标，移入恢复完整导航
  &.is-collapsed {
    padding: 3px;
    gap: 0;

    .nav-item {
      display: none;
    }

    // 收缩后的小竖条指示块
    &::after {
      content: "";
      display: block;
      width: 8px;
      height: 28px;
      border-radius: 4px;
      background: var(--color-primary);
      opacity: 0.6;
    }
  }

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: var(--color-text-secondary);
    text-decoration: none;
    cursor: pointer;
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
