import { createRouter, createWebHistory } from 'vue-router'
// 1. 根路径（/）对应你的主界面 App.vue
import App from '../App.vue'
// 2. 分享路径（/share/:shareId）对应分享查看页面 ShareView.vue
import ShareView from '../views/ShareView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: App // 访问根路径时，显示你的主界面（存档管理+绘图）
  },
  {
    path: '/share/:shareId',
    name: 'Share',
    component: ShareView // 访问分享路径时，显示只读的分享页面
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router