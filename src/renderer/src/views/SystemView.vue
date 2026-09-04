<script setup lang="ts">
// 系统功能演示页：文件操作 / 系统通知的实测入口（托盘为常驻行为，无需页面触发）
const openedFile = ref<{ path: string; content: string } | null>(null)
/** 可编辑的文本内容（打开后可修改再保存） */
const editingContent = ref('')
/** 操作反馈消息 */
const feedback = ref('')
/** 反馈类型：success / error */
const feedbackType = ref<'success' | 'error'>('success')

/** 打开文件并读取内容 */
async function handleOpenFile(): Promise<void> {
  feedback.value = ''
  try {
    const result = await window.api.selectAndReadFile('text')
    // 用户取消对话框属于正常流程，静默返回
    if (!result) return
    openedFile.value = result
    editingContent.value = result.content
  } catch (error) {
    // 读取失败（如权限不足、文件被锁）时给出可操作的提示
    showFeedback(`打开失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

/** 将编辑内容保存为新文件 */
async function handleSaveFile(): Promise<void> {
  if (!editingContent.value) {
    showFeedback('内容为空，请先输入或打开文件', 'error')
    return
  }
  try {
    const path = await window.api.saveFile({
      defaultName: 'note.txt',
      content: editingContent.value
    })
    if (!path) return
    showFeedback(`已保存：${path}`, 'success')
  } catch (error) {
    showFeedback(`保存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

/** 发送系统通知 */
async function handleNotify(): Promise<void> {
  try {
    const sent = await window.api.showNotification({
      title: '桌面应用',
      body: '这是一条来自主进程的系统通知，点击可回到窗口。'
    })
    if (!sent) {
      showFeedback('当前系统不支持通知', 'error')
    }
  } catch (error) {
    showFeedback(`通知发送失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

/** 统一反馈展示（成功/失败走同一入口，便于控制显示时长） */
function showFeedback(message: string, type: 'success' | 'error'): void {
  feedback.value = message
  feedbackType.value = type
}
</script>

<template>
  <section class="system-view">
    <h2>设置</h2>
    <p class="desc">
      Electron 系统能力演示：文件对话框、系统通知；托盘为常驻行为（关闭窗口即隐藏到托盘）。
    </p>

    <el-alert
      v-if="feedback"
      :title="feedback"
      :type="feedbackType"
      show-icon
      :closable="true"
      class="feedback"
      @close="feedback = ''"
    />

    <el-card shadow="never" class="card">
      <template #header>
        <div class="card-header">
          <span>文件操作</span>
          <div>
            <el-button @click="handleOpenFile">打开文件</el-button>
            <el-button type="primary" :disabled="!editingContent" @click="handleSaveFile">
              另存为
            </el-button>
          </div>
        </div>
      </template>
      <p v-if="openedFile" class="file-path">当前文件：{{ openedFile.path }}</p>
      <el-input
        v-model="editingContent"
        type="textarea"
        :rows="8"
        placeholder="点击「打开文件」选择文本文件，或直接输入内容后「另存为」"
        class="editor"
      />
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>
        <div class="card-header">
          <span>系统通知</span>
          <el-button type="primary" @click="handleNotify">发送通知</el-button>
        </div>
      </template>
      <p class="desc">通过主进程 Notification API 发送，点击通知可唤回窗口。</p>
    </el-card>
  </section>
</template>

<style lang="scss" scoped>
.system-view {
  padding: 24px;
  max-width: 860px;
  margin: 0 auto;

  h2 {
    font-size: 18px;
    margin-bottom: 6px;
  }

  .desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 18px;
  }

  .feedback {
    margin-bottom: 16px;

    // 长路径不换行会撑破布局
    :deep(.el-alert__title) {
      word-break: break-all;
    }
  }

  .card {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .file-path {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 10px;
    word-break: break-all;
  }

  .editor {
    :deep(.el-textarea__inner) {
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
    }
  }
}
</style>