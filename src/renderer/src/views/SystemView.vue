<script setup lang="ts">
// 设置页：应用版本展示（含更新角标）+ 关闭窗口时行为（托盘常驻 / 退出应用）
import type { UpdaterEvent } from '../../../preload/index.d'

const appVersion = ref('')
/** 关闭窗口是否隐藏到托盘（持久化到主进程 settings.json） */
const closeToTray = ref(true)
/** 设置加载中标记：避免在读取完成前误触发保存 */
const loading = ref(true)

/** 更新角标状态：unknown=未检查, checking, latest, error（下载/安装交互由更新弹窗承担） */
const updateState = ref<'unknown' | 'checking' | 'latest' | 'error'>('unknown')
/** 检查失败时拉取到的最新版本号（GitHub 最新 release，供手动下载） */
const latestVersion = ref('')
/** 最新版本下载页面地址（点击角标跳转系统浏览器） */
const latestUrl = ref('')

// 公开仓库的最新 release 接口与页面（同步于 electron-builder.yml 的 publish 配置）
const RELEASE_API = 'https://api.github.com/repos/NingDuiYan/DesktopAIApplications/releases/latest'
const RELEASE_PAGE = 'https://github.com/NingDuiYan/DesktopAIApplications/releases/latest'

let unsubscribeUpdate: (() => void) | null = null

/** 版本角标文案：仅"最新"与"检查失败兜底"两种语义，其余状态由更新弹窗负责 */
const badgeText = computed(() => {
  switch (updateState.value) {
    case 'latest':
      return '最新'
    case 'error':
      return latestVersion.value ? `最新 v${latestVersion.value}` : '最新版本'
    default:
      return ''
  }
})

/** 角标背景色（latest=绿色表示最新 / error=红色警示需手动下载） */
const badgeBg = computed(() =>
  updateState.value === 'latest' ? 'var(--el-color-success)' : 'var(--el-color-danger)'
)

/** 是否展示角标：只有"已是最新"或"检查失败"时才展示，其余静默 */
const badgeVisible = computed(() => updateState.value === 'latest' || updateState.value === 'error')

/** 角标是否可点击（仅检查失败且有下载地址时可跳转手动下载） */
const badgeClickable = computed(() => updateState.value === 'error' && !!latestUrl.value)

/** 点击角标：检查失败时跳转 GitHub Releases 页面手动下载 */
function handleBadgeClick(): void {
  if (updateState.value === 'error' && latestUrl.value) {
    // setWindowOpenHandler 已配置：外链交给系统浏览器打开
    window.open(latestUrl.value, '_blank')
  }
}

/** 检查失败后拉取最新 release 版本号（匿名访问公开仓库） */
async function fetchLatestRelease(): Promise<void> {
  if (latestUrl.value) return
  try {
    const res = await fetch(RELEASE_API)
    if (!res.ok) return
    const data = (await res.json()) as { tag_name?: string }
    latestVersion.value = String(data.tag_name ?? '').replace(/^v/, '')
    latestUrl.value = RELEASE_PAGE
  } catch {
    // 网络异常时保持空值，角标退化为不可点击的占位提示
  }
}

/** 订阅主进程更新广播，驱动角标状态（下载/安装流程由更新弹窗处理，此处只关心结果态） */
function handleUpdateEvent(payload: UpdaterEvent): void {
  switch (payload.type) {
    case 'not-available':
      updateState.value = 'latest'
      break
    case 'error':
      updateState.value = 'error'
      void fetchLatestRelease()
      break
  }
}

/** 切换"关闭时"行为：同步到主进程并落盘 */
async function handleCloseBehaviorChange(value?: string | number | boolean): Promise<void> {
  if (value === undefined) return
  try {
    const settings = await window.api.updateSettings({ closeToTray: Boolean(value) })
    closeToTray.value = settings.closeToTray
  } catch (error) {
    // 保存失败：回滚勾选状态，避免 UI 与真实行为不一致
    closeToTray.value = !value
    console.error('保存关闭行为设置失败:', error)
  }
}

/** 版本信息与设置初始化（任一失败需清晰提示，不能永久 loading） */
async function init(): Promise<void> {
  try {
    const [version, settings] = await Promise.all([
      window.api.getAppVersion(),
      window.api.getSettings()
    ])
    appVersion.value = version
    closeToTray.value = settings.closeToTray
  } finally {
    loading.value = false
  }
}

/** 若尚无检查结果则补查一次（应用启动时的检查广播可能早于本页订阅而丢失） */
async function ensureCheck(): Promise<void> {
  if (updateState.value !== 'unknown') return
  try {
    const supported = await window.api.checkForUpdate()
    // dev 模式下更新服务不可用，视为检查失败 → 展示最新版本并支持手动下载
    if (!supported) {
      updateState.value = 'error'
      void fetchLatestRelease()
    }
  } catch {
    updateState.value = 'error'
    void fetchLatestRelease()
  }
}

onMounted(() => {
  init()
  // 订阅更新事件驱动角标（自动检查在 App 根组件挂载时统一触发）
  unsubscribeUpdate = window.api.onUpdateEvent(handleUpdateEvent)
  ensureCheck()
})

onUnmounted(() => {
  // 移除事件订阅，防止内存泄漏与重复回调
  unsubscribeUpdate?.()
})
</script>

<template>
  <section class="system-view">
    <h2>设置</h2>

    <el-card shadow="never" class="card">
      <template #header>
        <span>应用信息</span>
      </template>
      <ul class="info-list" v-loading="loading">
        <li>
          <span class="label">应用版本</span>
          <div class="value-group">
            <span class="value">v{{ appVersion || '-' }}</span>
            <!-- 版本号右上角悬浮角标：仅在有明确更新结果时展示，背景色随状态切换 -->
            <span
              v-if="badgeVisible"
              class="version-badge"
              :class="{ 'is-clickable': badgeClickable }"
              :style="{ background: badgeBg }"
              @click="handleBadgeClick"
            >
              {{ badgeText }}
            </span>
          </div>
        </li>
      </ul>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>
        <span>关闭行为</span>
      </template>
      <!-- 关闭行为：单选组，选中即同步持久化 -->
      <div class="close-behavior">
        <el-radio-group
          v-model="closeToTray"
          :disabled="loading"
          @change="handleCloseBehaviorChange"
        >
          <el-radio :value="true">最小化到系统托盘</el-radio>
          <el-radio :value="false">退出应用</el-radio>
        </el-radio-group>
      </div>
    </el-card>
  </section>
</template>

<style lang="scss" scoped>
.system-view {
  padding: 24px;
  max-width: 640px;
  margin: 0 auto;

  h2 {
    font-size: 18px;
    margin-bottom: 18px;
  }

  .card {
    margin-bottom: 16px;
  }

  // 版本信息列表：标签与值左右分布
  .info-list {
    list-style: none;
    min-height: 40px;

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
    }

    .label {
      font-size: 14px;
      color: var(--color-text-primary);
    }

    // 版本号 + 右侧状态胶囊：同行水平排列，不再悬浮避免遮挡
    .value-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .value {
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--color-text-primary);
    }

    // 状态胶囊：紧凑小号，背景色随状态切换，可点击项有 hover 反馈
    .version-badge {
      font-size: 11px;
      font-weight: 500;
      height: 18px;
      line-height: 18px;
      padding: 0 8px;
      border-radius: 9px;
      color: #fff;
      white-space: nowrap;
      box-shadow: 0 1px 3px var(--el-box-shadow-lighter);

      &.is-clickable {
        cursor: pointer;

        &:hover {
          opacity: 0.85;
        }
      }
    }
  }

  // 关闭行为：单选组平铺展示
  .close-behavior {
    display: flex;
    align-items: center;
  }
}
</style>