<script setup lang="ts">
import type { UpdaterEvent } from "../../../preload/index.d";

/** 更新流程各阶段状态 */
type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

const isVisible = ref(false);
const status = ref<UpdateStatus>("idle");
const newVersion = ref("");
const releaseNotes = ref("");
const progressPercent = ref(0);
const errorMessage = ref("");
const isDevMode = ref(false);

let unsubscribe: (() => void) | null = null;

/** 处理主进程广播的更新事件 */
function handleUpdateEvent(payload: UpdaterEvent): void {
  switch (payload.type) {
    case "available":
      status.value = "available";
      newVersion.value = payload.version ?? "";
      releaseNotes.value = payload.notes ?? "";
      isVisible.value = true;
      break;
    case "progress":
      status.value = "downloading";
      progressPercent.value = payload.percent ?? 0;
      break;
    case "downloaded":
      status.value = "downloaded";
      break;
    case "error":
      status.value = "error";
      errorMessage.value = payload.message ?? "未知错误";
      break;
    // checking / not-available 不弹窗，静默处理
  }
}

/** 用户点击"立即更新"开始下载 */
async function handleDownload(): Promise<void> {
  try {
    status.value = "downloading";
    await window.api.downloadUpdate();
  } catch (error) {
    status.value = "error";
    errorMessage.value =
      error instanceof Error ? error.message : "下载请求失败";
  }
}

/** 用户点击"重启安装" */
async function handleInstall(): Promise<void> {
  await window.api.installUpdate();
}

onMounted(() => {
  // 启动时探测更新服务可用性；IPC 异常（如旧版主进程未注册频道）按不支持处理，不报错
  window.api
    .checkForUpdate()
    .then((supported) => {
      isDevMode.value = !supported;
    })
    .catch(() => {
      isDevMode.value = true;
    });
  unsubscribe = window.api.onUpdateEvent(handleUpdateEvent);
});

onUnmounted(() => {
  // 组件卸载时取消订阅，防止内存泄漏与重复回调
  unsubscribe?.();
});
</script>

<template>
  <el-dialog
    v-model="isVisible"
    title="软件更新"
    width="420px"
    :close-on-click-modal="false"
    :show-close="status !== 'downloading'"
    :close-on-press-escape="false"
    append-to-body
  >
    <!-- 发现新版本 -->
    <template v-if="status === 'available'">
      <p class="updater-body">
        发现新版本 <span class="version-tag">v{{ newVersion }}</span
        >，是否立即更新？
      </p>
      <pre v-if="releaseNotes" class="release-notes">{{ releaseNotes }}</pre>
    </template>

    <!-- 下载中 -->
    <template v-else-if="status === 'downloading'">
      <p class="updater-body">正在下载更新，请勿关闭应用…</p>
      <el-progress
        :percentage="progressPercent"
        :stroke-width="8"
        class="progress"
      />
    </template>

    <!-- 下载完成 -->
    <template v-else-if="status === 'downloaded'">
      <p class="updater-body">
        新版本
        <span class="version-tag">v{{ newVersion }}</span>
        已下载完成，重启应用以完成安装。
      </p>
    </template>

    <!-- 出错 -->
    <template v-else-if="status === 'error'">
      <el-alert
        :title="`更新失败：${errorMessage}`"
        type="error"
        show-icon
        :closable="false"
      />
    </template>

    <template #footer>
      <template v-if="status === 'available'">
        <el-button @click="isVisible = false">稍后再说</el-button>
        <el-button type="primary" @click="handleDownload">立即更新</el-button>
      </template>
      <template v-else-if="status === 'downloading'">
        <span class="downloading-hint">下载中…</span>
      </template>
      <template v-else-if="status === 'downloaded'">
        <el-button type="primary" @click="handleInstall">重启并安装</el-button>
      </template>
      <template v-else-if="status === 'error'">
        <el-button @click="isVisible = false">关闭</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.updater-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
}

.version-tag {
  color: var(--color-primary);
  font-weight: 600;
}

.release-notes {
  margin-top: 10px;
  max-height: 180px;
  overflow: auto;
  padding: 10px;
  background: var(--color-bg);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text-secondary);
}

.progress {
  margin-top: 14px;
}

.downloading-hint {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
