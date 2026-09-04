<script setup lang="ts">
// 软件更新弹窗：展示版本对比、下载进度与安装引导，随主进程更新事件自动弹出
import { Download, Right, CircleCheck, WarningFilled } from '@element-plus/icons-vue'
import type { UpdaterEvent } from '../../../preload/index.d'

/** 更新流程各阶段状态 */
type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

const isVisible = ref(false)
const status = ref<UpdateStatus>('idle')
const currentVersion = ref('')
const newVersion = ref('')
const releaseNotes = ref('')
const progressPercent = ref(0)
const errorMessage = ref('')

let unsubscribe: (() => void) | null = null

/** 弹窗标题（按状态切换） */
const headerTitle = computed(() => {
  switch (status.value) {
    case 'downloading':
      return '正在下载更新'
    case 'downloaded':
      return '更新完成'
    case 'error':
      return '更新失败'
    default:
      return '发现新版本'
  }
})

/** 弹窗副标题（按状态切换） */
const headerDesc = computed(() => {
  switch (status.value) {
    case 'downloading':
      return '下载完成后将提示重启安装，请稍候'
    case 'downloaded':
      return '新版本已就绪，重启应用完成安装'
    case 'error':
      return '更新过程中出现问题，请重试'
    default:
      return '新版本带来更好体验，建议立即更新'
  }
})

/** 处理主进程广播的更新事件 */
function handleUpdateEvent(payload: UpdaterEvent): void {
  switch (payload.type) {
    case 'available':
      status.value = 'available'
      newVersion.value = payload.version ?? ''
      releaseNotes.value = payload.notes ?? ''
      isVisible.value = true
      break
    case 'progress':
      status.value = 'downloading'
      progressPercent.value = payload.percent ?? 0
      break
    case 'downloaded':
      status.value = 'downloaded'
      break
    case 'error':
      status.value = 'error'
      errorMessage.value = payload.message ?? '未知错误'
      break
    // checking / not-available 不弹窗，静默处理
  }
}

/** 用户点击"立即更新"开始下载 */
async function handleDownload(): Promise<void> {
  try {
    status.value = 'downloading'
    await window.api.downloadUpdate()
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '下载请求失败'
  }
}

/** 用户点击"重启安装" */
async function handleInstall(): Promise<void> {
  await window.api.installUpdate()
}

onMounted(() => {
  // 展示当前版本用于对比；失败不影响弹窗使用
  window.api.getAppVersion().then((v) => (currentVersion.value = v)).catch(() => {})
  unsubscribe = window.api.onUpdateEvent(handleUpdateEvent)
})

onUnmounted(() => {
  // 组件卸载时取消订阅，防止内存泄漏与重复回调
  unsubscribe?.()
})
</script>

<template>
  <el-dialog
    v-model="isVisible"
    class="update-dialog"
    width="440px"
    :show-close="status !== 'downloading'"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
  >
    <!-- 自定义头部：状态图标 + 标题 -->
    <template #header>
      <div class="dialog-header">
        <div
          class="update-icon"
          :class="{
            'is-error': status === 'error',
            'is-done': status === 'downloaded',
            'is-downloading': status === 'downloading'
          }"
        >
          <el-icon :size="24">
            <CircleCheck v-if="status === 'downloaded'" />
            <WarningFilled v-else-if="status === 'error'" />
            <Download v-else />
          </el-icon>
        </div>
        <div class="header-text">
          <h3 class="header-title">{{ headerTitle }}</h3>
          <p class="header-desc">{{ headerDesc }}</p>
        </div>
      </div>
    </template>

    <!-- 发现新版本：版本对比 + 更新说明 -->
    <template v-if="status === 'available'">
      <div class="version-compare">
        <div class="ver">
          <span class="ver-label">当前版本</span>
          <span class="ver-value">v{{ currentVersion || '—' }}</span>
        </div>
        <el-icon class="compare-arrow"><Right /></el-icon>
        <div class="ver is-new">
          <span class="ver-label">最新版本</span>
          <span class="ver-value highlight">v{{ newVersion }}</span>
        </div>
      </div>
      <pre v-if="releaseNotes" class="release-notes">{{ releaseNotes }}</pre>
    </template>

    <!-- 下载中：进度条 + 百分比 -->
    <template v-else-if="status === 'downloading'">
      <el-progress
        :percentage="progressPercent"
        :stroke-width="10"
        :show-text="false"
        class="progress"
      />
      <div class="progress-meta">
        <span>正在下载 v{{ newVersion }}…</span>
        <span class="percent">{{ progressPercent }}%</span>
      </div>
      <p class="warm-tip">下载期间请保持应用运行，请勿关闭</p>
    </template>

    <!-- 下载完成 -->
    <template v-else-if="status === 'downloaded'">
      <div class="done-tip">
        <el-icon class="done-icon"><CircleCheck /></el-icon>
        <div>
          <p class="tip-title">v{{ newVersion }} 已下载完成</p>
          <p class="tip-desc">点击下方按钮重启应用，即完成更新安装</p>
        </div>
      </div>
    </template>

    <!-- 出错 -->
    <template v-else-if="status === 'error'">
      <div class="error-tip">
        <el-icon class="error-icon"><WarningFilled /></el-icon>
        <div>
          <p class="tip-title">更新过程出现问题</p>
          <p class="tip-desc error-desc">{{ errorMessage }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="status === 'available'">
        <el-button round @click="isVisible = false">稍后再说</el-button>
        <el-button round type="primary" @click="handleDownload">
          立即更新
        </el-button>
      </template>
      <template v-else-if="status === 'downloading'">
        <span class="downloading-hint">{{ progressPercent }}%</span>
      </template>
      <template v-else-if="status === 'downloaded'">
        <el-button round type="primary" @click="handleInstall">
          重启并安装
        </el-button>
      </template>
      <template v-else-if="status === 'error'">
        <el-button round @click="isVisible = false">关闭</el-button>
        <el-button round type="primary" @click="handleDownload">重试下载</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
// 弹窗整体：自绘头部，去掉默认内边距与标题样式
.update-dialog {
  :deep(.el-dialog__header) {
    padding: 0;
    border-bottom: 1px solid var(--color-border);
    margin-right: 0;
  }

  :deep(.el-dialog__body) {
    padding: 20px 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 24px 20px;
  }
}

// 头部：左侧状态图标 + 右侧标题
.dialog-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px 16px;

  .update-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: #fff;
    background: linear-gradient(135deg, #409eff, #6aa8f5);
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
    flex-shrink: 0;

    // 下载中：微呼吸动画提示进行中
    &.is-downloading {
      animation: breathe 1.5s ease-in-out infinite;
    }

    // 完成：绿色成功渐变
    &.is-done {
      background: linear-gradient(135deg, #67c23a, #8fd170);
      box-shadow: 0 4px 12px rgba(103, 194, 58, 0.35);
    }

    // 失败：红色警示渐变
    &.is-error {
      background: linear-gradient(135deg, #f56c6c, #f79a9a);
      box-shadow: 0 4px 12px rgba(245, 108, 108, 0.35);
    }
  }

  .header-text {
    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary);
      line-height: 1.3;
    }

    .header-desc {
      margin-top: 2px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
  }
}

// 版本对比：当前 → 最新
.version-compare {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--color-bg-muted, #f5f7fa);
  border: 1px solid var(--color-border);

  .ver {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    &.is-new {
      text-align: right;
    }

    .ver-label {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .ver-value {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;

      &.highlight {
        color: var(--el-color-primary);
      }
    }
  }

  .compare-arrow {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
}

// 更新说明
.release-notes {
  margin-top: 14px;
  max-height: 180px;
  overflow: auto;
  padding: 10px 12px;
  background: var(--color-bg-muted, #f5f7fa);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text-secondary);
}

// 下载进度
.progress {
  margin-top: 6px;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-primary);

  .percent {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--el-color-primary);
  }
}

.warm-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}

// 完成/失败提示块
.done-tip,
.error-tip {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .done-icon {
    font-size: 22px;
    color: #67c23a;
    margin-top: 1px;
  }

  .error-icon {
    font-size: 22px;
    color: #f56c6c;
    margin-top: 1px;
  }

  .tip-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .tip-desc {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .error-desc {
    word-break: break-all;
    max-height: 90px;
    overflow: auto;
  }
}

.downloading-hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}

// 下载中图标呼吸动画
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}
</style>