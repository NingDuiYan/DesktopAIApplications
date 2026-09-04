import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SystemView from '../views/SystemView.vue'

/**
 * 应用路由。
 * 桌面应用以 file:// 协议加载，必须使用 hash 模式路由。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/system',
      name: 'system',
      component: SystemView
    }
  ]
})

export default router