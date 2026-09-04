import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.scss'

// 创建应用实例并挂载 router 与状态管理
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')