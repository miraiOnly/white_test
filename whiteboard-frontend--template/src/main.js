import { createApp } from 'vue'
import './style.css'
// 1. 导入根组件 Main.vue
import Main from './Main.vue'
// 2. 导入路由实例
import router from './router'

// 3. 创建应用，挂载 Main.vue
createApp(Main)
  .use(router)
  .mount('#app')