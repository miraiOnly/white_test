<template>
  <div class="share-container">
    <div class="toolbar">
      <h2 class="board-title">共享白板查看：{{ boardTitle }}</h2>
      <span class="status">
        {{ isConnected ? '实时同步中' : '连接中...' }}
      </span>
      
    </div>
    <div class="overlay" v-if="isLoading || errorMsg">
      <div class="overlay-content">
        <div v-if="isLoading">加载共享白板中...</div>
        <div class="error" v-if="errorMsg">{{ errorMsg }}</div>
      </div>
    </div>
    <div class="canvas-container" @mousedown.prevent @mouseup.prevent @click.prevent @dblclick.prevent @mousemove.prevent>
      <canvas id="share-canvas" width="1200" height="800"></canvas>
    </div>
  </div>
</template>

<script setup>
// 导入需要用到的vue和fabric相关的东西
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
import * as fabric from 'fabric'
import { useRoute } from 'vue-router'

// 定义需要用到的变量
const route = useRoute()
const shareId = route.params.shareId
const isLoading = ref(true)
const errorMsg = ref('')
const boardTitle = ref('未命名白板')
const isConnected = ref(false) // 标记是否实时同步
const canvas = ref(null) // 画布实例，用ref存
let ws = null // WebSocket的实例
let reconnectTimer = null // 自动重连的定时器

// WebSocket相关的函数
// 创建WebSocket连接
const createWebSocket = () => {
  if (ws) ws.close() // 先关旧连接，避免重复连接

  // 连接后端的WebSocket服务
  ws = new WebSocket(`ws://${window.location.hostname}:3000`)

  // 连接成功的处理
  ws.onopen = () => {
    console.log('WebSocket连接成功')
    isConnected.value = true
    // 告诉后端当前用户看的是哪个分享链接
    ws.send(JSON.stringify({ type: 'bind', shareId: shareId }))
  }

  // 接收后端推送的更新，自动刷新画布
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      // 只处理更新类型的消息
      if (data.type === 'update' && data.content) {
        console.log('收到更新，准备刷新画布')
        
        // 检查画布是否准备好了
        if (!canvas.value || !(canvas.value instanceof fabric.Canvas)) {
          console.log('画布没准备好，100ms后再试')
          setTimeout(() => ws.onmessage(event), 100)
          return
        }

        // 解析画布内容，兼容字符串和对象格式
        const jsonData = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content

        // 把最新内容加载到画布上
        canvas.value.loadFromJSON(jsonData, async () => {
          // 设为只读，禁止所有操作
          canvas.value.forEachObject(obj => {
            obj.selectable = false
            obj.evented = false
            obj.lockMovementX = obj.lockMovementY = true
            obj.lockScalingX = obj.lockScalingY = true
            obj.lockRotation = true
          })

          // 强制渲染画布，解决加载后不显示的问题
          canvas.value.renderAll()

          // 设置画布尺寸，加延迟避免出错，没值就用默认的
          await new Promise(resolve => setTimeout(resolve, 50))
          const canvasDom = document.getElementById('share-canvas')
          const width = canvasDom.offsetWidth || 1200 
          const height = canvasDom.offsetHeight || 800

          // 设置画布大小，兼容不同写法
          if (canvas.value.setDimensions) {
            canvas.value.setDimensions({ width, height })
          } else {
            canvasDom.width = width
            canvasDom.height = height
          }

          // 最后再渲染一次
          canvas.value.renderAll()
          console.log('画布刷新成功！')
        })

        // 更新白板标题
        if (data.title) {
          boardTitle.value = data.title
        }
      }
    } catch (err) {
      console.error('刷新失败：', err)
      alert('更新失败，请手动刷新一次～')
    }
  }

  // 连接断开时自动重连
  ws.onclose = () => {
    console.log('WebSocket断开，5秒后自动重连')
    isConnected.value = false
    reconnectTimer = setTimeout(createWebSocket, 5000)
  }

  // 连接出错的处理
  ws.onerror = (err) => {
    console.error('WebSocket错误：', err)
    isConnected.value = false
  }
}

// 关闭WebSocket连接，页面卸载时调用
const closeWebSocket = () => {
  if (ws) ws.close()
  if (reconnectTimer) clearTimeout(reconnectTimer)
}

// 加载共享白板的初始内容
const loadSharedContent = async (canvasDom) => {
  try {
    // 调用后端接口，通过shareId获取白板内容
    const res = await fetch(`/api/whiteboard/get-by-share?shareId=${shareId}`)
    const data = await res.json()

    // 接口返回错误的处理
    if (!res.ok) throw new Error(data.error || '分享链接无效')
    if (!data.content) throw new Error('白板内容不存在')

    // 设置白板标题
    boardTitle.value = data.title || '未命名白板'

    // 解析画布内容，兼容不同格式
    const jsonData = typeof data.content === 'string' 
      ? JSON.parse(data.content) 
      : data.content

    // 检查画布实例是否正常
    if (!canvas.value || !(canvas.value instanceof fabric.Canvas)) {
      throw new Error('画布初始化失败，加载不了内容')
    }

    // 加载内容到画布
    canvas.value.loadFromJSON(jsonData, async () => {
      // 禁用所有操作，只能看不能改
      canvas.value.forEachObject(obj => {
        obj.selectable = false
        obj.evented = false
        obj.lockMovementX = obj.lockMovementY = true
        obj.lockScalingX = obj.lockScalingY = true
        obj.lockRotation = true
      })

      // 强制渲染
      canvas.value.renderAll()

      // 设置画布尺寸，加延迟防错
      await new Promise(resolve => setTimeout(resolve, 50))
      const width = canvasDom.offsetWidth || 1200
      const height = canvasDom.offsetHeight || 800

      if (canvas.value.setDimensions) {
        canvas.value.setDimensions({ width, height })
      } else {
        canvasDom.width = width
        canvasDom.height = height
      }

      // 最后渲染，隐藏加载提示
      await new Promise(resolve => setTimeout(resolve, 50))
      canvas.value.renderAll()
      isLoading.value = false
    })
  } catch (err) {
    errorMsg.value = err.message
    isLoading.value = false
  }
}

// 页面挂载时执行的操作：初始化画布+连接WebSocket
onMounted(async () => {
  try {
    await nextTick() // 等DOM加载完
    const canvasDom = document.getElementById('share-canvas')
    if (!canvasDom) throw new Error('没找到画布元素')

    // 创建fabric画布实例，设置只读相关的配置
    canvas.value = new fabric.Canvas(canvasDom, {
      backgroundColor: '#ffffff',
      selection: false, // 禁止选择
      hasControls: false, // 禁止控制手柄
      hasBorders: false, // 禁止边框
      hoverCursor: 'default'
    })

    // 加载初始内容 + 建立WebSocket连接
    await loadSharedContent(canvasDom)
    createWebSocket()
  } catch (err) {
    errorMsg.value = err.message || '加载失败，请刷新页面'
    isLoading.value = false
  }
})

// 页面卸载时：关闭WebSocket，释放资源
onUnmounted(() => {
  closeWebSocket()
})
</script>

<style scoped>
.share-container {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 20px;
  font-family: "Microsoft Yahei", sans-serif;
  position: relative;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  padding: 14px 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  position: relative;
}

.board-title {
  color: #333;
  font-size: 18px;
  margin: 0;
  text-align: center;
}

.status {
  position: absolute;
  left: 20px;
  font-size: 14px;
  color: #27ae60;
}

.back-btn {
  position: absolute;
  right: 20px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background-color: #2c3e50;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.canvas-container {
  width: 100%;
  height: 800px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #e1e5eb;
  background-color: #ffffff;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  pointer-events: none !important;
}

#share-canvas {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none !important;
  user-select: none !important;
  touch-action: none !important;
  -webkit-user-drag: none !important;
}

.overlay {
  position: absolute;
  top: 100px;
  left: 20px;
  right: 20px;
  height: 800px;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  z-index: 10;
}

.overlay-content {
  font-size: 18px;
  color: #666;
}

.overlay .error {
  color: #e74c3c;
}
</style>