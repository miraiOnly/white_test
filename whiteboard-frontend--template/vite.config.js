import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite的配置文件，主要设置前端服务和跨域代理
export default defineConfig({
  plugins: [vue()],
  // 开发服务器的配置
  server: {
    port: 8080, // 前端运行的端口，可以改，避免和后端端口冲突
    strictPort: false, // 端口被占用时，自动切换到下一个可用端口
    host: '0.0.0.0',   // 让本地和局域网的IP都能访问前端页面
    open: true,        // 启动项目后自动打开浏览器
    proxy: {
      // 所有以 /api 开头的请求，都会转发到后端地址
      '/api': {
        target: 'http://localhost:3000', // 替换成你后端实际运行的地址
        changeOrigin: true, // 解决跨域问题
        //rewrite: (path) => path.replace(/^\/api/, '') // 如果后端接口没有/api前缀，就打开这行注释
      }
    }
  }
})