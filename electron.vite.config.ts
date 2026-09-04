import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'node:path'

// electron-vite 统一构建主进程 / 预加载 / 渲染进程三端
export default defineConfig({
  // 主进程：外部依赖不打包，运行时从 node_modules 加载
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  // 预加载脚本：同样外部化依赖
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  // 渲染进程：Vue3 + Element Plus 按需自动引入 + 路径别名
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(),
      // 自动导入 Vue API（ref/computed 等）与 ElMessage 等常用方法
      AutoImport({
        imports: ['vue'],
        resolvers: [ElementPlusResolver()],
        // 生成类型声明文件，供 TS 识别自动导入的 API（相对 renderer root：src/renderer）
        dts: 'src/auto-imports.d.ts'
      }),
      // 按需引入模板中使用的 Element Plus 组件及其样式
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
        dts: 'src/components.d.ts'
      })
    ],
    // SCSS 全局注入：Element Plus 主题变量定制入口
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@renderer/assets/styles/element-theme.scss" as *;`
        }
      }
    }
  }
})