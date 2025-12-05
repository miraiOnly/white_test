<template>
  <div class="app-container">
    <!-- 管理界面 -->
    <div class="board-manager" :style="{ display: showBoardManager ? 'block' : 'none' }">
      <h2>白板存档管理</h2>
      <button @click="createNewBoard" class="btn primary-btn">+ 创建新白板</button>
      
      <div class="board-list">
        <div class="board-item" v-for="board in boardList" :key="board.boardId">
          <div class="board-info">
            <div class="board-title">{{ board.title }}</div>
            <div class="board-time">{{ board.createdAt }}</div>
          </div>
          <div class="board-actions">
            <button @click="loadBoard(board.boardId)" class="btn btn-sm import-btn">导入</button>
            <button @click="deleteBoard(board.boardId)" class="btn btn-sm delete-btn">删除</button>
          </div>
        </div>
      </div>
      
      <div class="empty-tip" v-if="boardList.length === 0">
        暂无白板存档，点击"创建新白板"开始使用
      </div>
    </div>

    <!-- 绘图界面 -->
    <div class="whiteboard-wrapper" :style="{ display: showBoardManager ? 'none' : 'block' }">
      <div class="whiteboard-toolbar">
        <button @click="backToManager" class="toolbar-btn">返回存档管理</button>
        <!-- 撤销/重做按钮 -->
        <button 
          @click="undo" 
          class="toolbar-btn" 
          :disabled="!canUndo()"
          style="background-color: #9b59b6;"
          title="撤销（Ctrl+Z）"
        >撤销</button>
        <button 
          @click="redo" 
          class="toolbar-btn" 
          :disabled="!canRedo()"
          style="background-color: #8e44ad;"
          title="重做（Ctrl+Y）"
        >重做</button>

        <input
          v-model="currentBoardTitle"
          class="board-title-input"
          placeholder="输入白板标题"
          @blur="updateBoardTitle"
          :disabled="!canvasReady"
        >
        
        <!-- 基础工具 -->
        <button 
          @click="setTool('select')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'select' }"
        >选择</button>
        <button 
          @click="setTool('pen')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'pen' }"
        >画笔</button>
        <!-- 橡皮擦按钮 -->
        <button 
          @click="setTool('eraser')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'eraser' }"
          style="background-color: #7f8c8d;"
        >橡皮擦</button>
        <button 
          @click="setTool('text')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'text' }"
        >文本</button>
        
        <!-- 图形工具 -->
        <button 
          @click="setTool('rect')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'rect' }"
        >矩形</button>
        <button 
          @click="setTool('circle')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'circle' }"
        >圆形</button>
        <button 
          @click="setTool('line')" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          :class="{ active: currentTool === 'line' }"
        >线段</button>
        
        <!-- 样式控制 -->
        <div class="style-controls" :style="{ display: canvasReady ? 'flex' : 'none' }">
          <label>颜色:</label>
          <input 
            type="color" 
            v-model="currentColor" 
            class="color-picker"
            :disabled="!canvasReady"
          >
          <label>大小:</label>
          <input 
            type="number" 
            v-model.number="currentStrokeWidth" 
            min="1" 
            max="50" 
            class="stroke-width"
            :disabled="!canvasReady"
          >
          <label>虚线:</label>
          <input 
            type="checkbox" 
            v-model="isDashed" 
            class="dashed-toggle"
            :disabled="!canvasReady"
          >
        </div>
        
        <button 
          @click="deleteActiveElement" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          style="background-color: #e74c3c;"
        >删除选中</button>
        <button 
          @click="saveWhiteboard" 
          class="toolbar-btn" 
          :disabled="!canvasReady"
          style="background-color: #27ae60;"
        >保存白板</button>

        <!-- 生成分享链接按钮 -->
        <button 
          @click="generateShareLink" 
          class="toolbar-btn" 
          style="background-color: #f39c12;"
          :disabled="!canvasReady || isLoading"
        >生成分享链接</button>

        <!-- 分享链接显示区域 -->
        <div class="share-link-wrap" v-if="shareLink" :style="{ display: canvasReady ? 'flex' : 'none' }">
          <input 
            type="text" 
            :value="shareLink" 
            readonly 
            class="share-link-input"
            @click="copyToClipboard"
            placeholder="点击复制分享链接"
          >
          <span class="copy-tip" v-if="copySuccess">已复制！</span>
        </div>
        
        <!-- 缩放比例显示 -->
        <div class="zoom-info" :style="{ display: canvasReady && currentTool === 'select' ? 'block' : 'none' }">
          缩放：{{ Math.round(canvasZoom * 100) }}%
        </div>
      </div>

      <div class="canvas-tip" :style="{ display: canvasReady ? 'block' : 'none' }">
        选择模式：Ctrl+滚轮缩放 | Alt+拖动平移 | Shift+点击多选 | 图形工具：点击拖拽绘制
      </div>

      <div class="loading-tip" :style="{ display: isLoading ? 'block' : 'none' }">加载中...</div>
      <div class="canvas-container">
        <canvas id="whiteboard-canvas" width="1200" height="800" class="canvas-element"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import * as fabric from 'fabric'

// 定义页面的核心状态变量
const showBoardManager = ref(true)
// 分享功能相关的变量
const shareLink = ref('')
const copySuccess = ref(false)
const boardList = ref([])
const currentBoardId = ref(null)
const currentBoardTitle = ref('未命名白板')
const canvasInstance = ref(null)
const currentTool = ref('select')
const isLoading = ref(false)
const canvasReady = ref(false)
let isNewBoardFlag = false
const canvasZoom = ref(1.0)

// 撤销和重做需要用到的变量
const undoHistory = ref([])
const redoHistory = ref([])
const MAX_HISTORY_LENGTH = 50
let isRecording = false
let currentBindBoardId = null // 绑定当前存档ID，区分不同白板的历史记录

// 样式控制的变量
const currentColor = ref('#2c3e50')
const currentStrokeWidth = ref(5)
const isDashed = ref(false)

// 画布状态相关的变量
let isPanning = false
let lastPointer = { x: 0, y: 0 }
let canvasDom = null
let globalWheelListener = null
let isDrawingShape = false
let shapeStartPoint = null
let currentDrawingShape = null

// 保存画布的状态，方便撤销重做
const saveCanvasState = () => {
  if (!canvasInstance.value || isRecording || !canvasReady.value || !currentBindBoardId) return

  // 把画布状态转成JSON格式保存
  const currentState = {
    objects: canvasInstance.value.toJSON([
      'left', 'top', 'width', 'height', 'fill', 'stroke', 
      'strokeWidth', 'text', 'fontSize', 'selectable', 'strokeDashArray',
      'type', 'radius', 'x1', 'y1', 'x2', 'y2'
    ]).objects,
    viewportTransform: [...canvasInstance.value.viewportTransform],
    canvasZoom: canvasZoom.value,
    boardId: currentBindBoardId // 绑定对应的白板ID
  }
  
  undoHistory.value.push(currentState)
  if (undoHistory.value.length > MAX_HISTORY_LENGTH) {
    undoHistory.value.shift() // 只保留最新的50条记录
  }
  redoHistory.value = [] // 有新操作就清空重做的记录
}

// 撤销操作
const undo = () => {
  if (undoHistory.value.length <= 1 || !canvasInstance.value || !canvasReady.value) {
    alert('已无可撤销操作！')
    return
  }

  isRecording = true

  // 把当前状态放到重做队列里
  const currentState = undoHistory.value.pop()
  redoHistory.value.push(currentState)
  
  // 取出上一个状态恢复
  const prevState = undoHistory.value[undoHistory.value.length - 1]
  canvasInstance.value.loadFromJSON(
    { objects: prevState.objects },
    async () => {
      // 恢复画布的显示状态
      try {
        // 重置画布尺寸，防止内容显示偏移
        const canvasDom = document.getElementById('whiteboard-canvas')
        if (canvasDom) {
          canvasInstance.value.setDimensions({
            width: canvasDom.offsetWidth,
            height: canvasDom.offsetHeight
          })
        }

        // 同步缩放和平移的状态
        canvasInstance.value.viewportTransform = [...prevState.viewportTransform]
        canvasZoom.value = prevState.canvasZoom

        // 重置当前工具的状态
        setTool(currentTool.value)

        // 多次渲染确保内容显示正常
        canvasInstance.value.renderAll()
        await new Promise(resolve => setTimeout(resolve, 20))
        canvasInstance.value.renderAll()
        canvasInstance.value.requestRenderAll()

        console.log('撤销后渲染完成')
      } catch (err) {
        console.error('撤销渲染失败：', err)
      } finally {
        isRecording = false
      }
    },
    (err) => {
      console.error('撤销加载失败：', err)
      isRecording = false
    }
  )
}

// 重做操作
const redo = () => {
  if (redoHistory.value.length === 0 || !canvasInstance.value || !canvasReady.value) {
    alert('已无可重做操作！')
    return
  }

  isRecording = true

  // 把重做队列里的状态放回撤销队列
  const redoState = redoHistory.value.pop()
  undoHistory.value.push(redoState)
  
  // 恢复重做的状态
  canvasInstance.value.loadFromJSON(
    { objects: redoState.objects },
    async () => {
      // 恢复画布的显示状态
      try {
        // 重置画布尺寸
        const canvasDom = document.getElementById('whiteboard-canvas')
        if (canvasDom) {
          canvasInstance.value.setDimensions({
            width: canvasDom.offsetWidth,
            height: canvasDom.offsetHeight
          })
        }

        // 同步缩放和平移的状态
        canvasInstance.value.viewportTransform = [...redoState.viewportTransform]
        canvasZoom.value = redoState.canvasZoom

        // 重置当前工具的状态
        setTool(currentTool.value)

        // 多次渲染确保内容显示正常
        canvasInstance.value.renderAll()
        await new Promise(resolve => setTimeout(resolve, 20))
        canvasInstance.value.renderAll()
        canvasInstance.value.requestRenderAll()

        console.log('重做后渲染完成')
      } catch (err) {
        console.error('重做渲染失败：', err)
      } finally {
        isRecording = false
      }
    },
    (err) => {
      console.error('重做加载失败：', err)
      isRecording = false
    }
  )
}

// 判断撤销/重做按钮能不能点击
const canUndo = () => undoHistory.value.length > 1 && canvasReady.value
const canRedo = () => redoHistory.value.length > 0 && canvasReady.value

// 页面加载完成后执行的操作
onMounted(async () => {
  await fetchAllBoards()
  await nextTick()
  setTimeout(() => {
    canvasDom = document.getElementById('whiteboard-canvas')
    if (canvasDom) {
      console.log('画布DOM加载成功')
      bindGlobalWheelListener()
    } else {
      console.error('画布DOM不存在！')
      alert('画布加载失败，请刷新页面重试')
    }
  }, 500)
  // 绑定键盘按键事件
  window.addEventListener('keydown', handleKeydown)
})

// 页面关闭时执行的操作
onUnmounted(() => {
  if (canvasInstance.value) {
    canvasInstance.value.dispose()
  }
  if (globalWheelListener) {
    document.removeEventListener('wheel', globalWheelListener, { passive: false, capture: true })
  }
  window.removeEventListener('keydown', handleKeydown)
})

// 监听全局滚轮事件，处理画布缩放
const bindGlobalWheelListener = () => {
  globalWheelListener = (e) => {
    if (e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      if (currentTool.value === 'select' && canvasInstance.value && canvasReady.value) {
        handleCanvasZoom(e)
      }
      return false
    }
  }
  document.addEventListener('wheel', globalWheelListener, { passive: false, capture: true })
}

// 处理画布的缩放
const handleCanvasZoom = (e) => {
  const canvas = canvasInstance.value
  if (!canvas || !canvasDom) return

  const delta = e.deltaY > 0 ? -0.1 : 0.1
  let newZoom = canvasZoom.value + delta
  newZoom = Math.max(0.2, Math.min(3, newZoom)) // 限制缩放范围

  const rect = canvasDom.getBoundingClientRect()
  const canvasX = (e.clientX - rect.left) / rect.width * canvasDom.width
  const canvasY = (e.clientY - rect.top) / rect.height * canvasDom.height

  canvas.zoomToPoint({ x: canvasX, y: canvasY }, newZoom)
  canvasZoom.value = newZoom
  canvas.renderAll()
}

// 获取所有的白板存档列表
const fetchAllBoards = async () => {
  try {
    const res = await fetch('/api/whiteboards')
    const data = await res.json()
    boardList.value = data || []
  } catch (err) {
    console.error('获取存档列表失败：', err)
    alert('获取存档失败，请检查后端是否启动')
  }
}

// 创建新的白板
const createNewBoard = async () => {
  isLoading.value = true
  canvasReady.value = false
  currentTool.value = 'select'
  canvasZoom.value = 1.0
  isNewBoardFlag = true

  try {
    showBoardManager.value = false
    currentBoardId.value = null
    currentBoardTitle.value = `白板-${new Date().toLocaleString().slice(0, 10)}`

    await nextTick()
    const canvas = await initCanvas({})
    canvasInstance.value = canvas
    canvasReady.value = true

    // 初始化撤销重做的历史记录
    undoHistory.value = []
    redoHistory.value = []
    currentBindBoardId = 'new_' + Date.now() // 给新白板加个临时ID
    saveCanvasState() // 保存初始的空白状态
  } catch (err) {
    console.error('创建新白板失败：', err)
    alert('创建失败，请重试')
    showBoardManager.value = true
    canvasReady.value = false
  } finally {
    isLoading.value = false
  }
}

// 加载已有的白板存档
const loadBoard = async (boardId) => {
  isLoading.value = true
  canvasReady.value = false
  currentTool.value = 'select'
  canvasZoom.value = 1.0
  isNewBoardFlag = false

  try {
    const res = await fetch(`/api/whiteboard?id=${boardId}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    currentBoardId.value = boardId
    currentBoardTitle.value = data.title
    showBoardManager.value = false

    await nextTick()
    const canvas = await initCanvas(data.content)
    canvasInstance.value = canvas
    canvasReady.value = true
    canvas.renderAll()

    shareLink.value = ''
    copySuccess.value = false

    // 初始化撤销重做的历史记录
    undoHistory.value = []
    redoHistory.value = []
    currentBindBoardId = boardId // 绑定当前白板的ID
    saveCanvasState() // 保存加载后的初始状态
  } catch (err) {
    console.error('加载白板失败：', err)
    alert(err.message || '加载失败，请重试')
    showBoardManager.value = true
    canvasReady.value = false
  } finally {
    isLoading.value = false
  }
}

// 删除白板存档
const deleteBoard = async (boardId) => {
  if (!confirm('确定要删除这个存档吗？删除后无法恢复！')) return
  try {
    await fetch(`/api/whiteboard/${boardId}`, { method: 'DELETE' })
    boardList.value = boardList.value.filter(board => board.boardId !== boardId)
    if (currentBoardId.value === boardId && !showBoardManager.value) {
      backToManager()
    }
  } catch (err) {
    console.error('删除白板失败：', err)
    alert('删除失败，请检查后端是否启动')
  }
}

// 初始化画布
const initCanvas = async (content = {}) => {
  return new Promise((resolve, reject) => {
    if (!canvasDom) {
      reject(new Error('画布元素不存在'))
      return
    }

    if (canvasInstance.value) {
      canvasInstance.value.dispose()
    }

    const canvas = new fabric.Canvas(canvasDom, {
      isDrawingMode: false,
      backgroundColor: '#ffffff',
      selection: true,
      enableRetinaScaling: false,
      preserveObjectStacking: true,
      targetFindTolerance: 4,
      centeredScaling: false,
      wheelEventTarget: null
    })

    // 监听画布的绘制和修改事件，保存状态
    canvas.on('path:created', () => setTimeout(saveCanvasState, 10))
    canvas.on('object:modified', () => setTimeout(saveCanvasState, 10))

    if (content && Object.keys(content).length > 0) {
      canvas.loadFromJSON(content, () => {
        canvas.renderAll()
        setTimeout(() => resolve(canvas), 50)
      }, (err) => {
        console.error('加载内容失败：', err)
        reject(new Error('加载内容失败'))
      })
    } else {
      setTimeout(() => resolve(canvas), 50)
    }
  })
}

// 返回存档管理界面
const backToManager = async () => {
  isLoading.value = true
  try {
    if (canvasInstance.value) {
      canvasInstance.value.dispose()
      canvasInstance.value = null
    }
    currentBoardId.value = null
    currentTool.value = 'select'
    canvasZoom.value = 1.0
    canvasReady.value = false
    showBoardManager.value = true
    await fetchAllBoards()
    shareLink.value = ''
    copySuccess.value = false

    // 清空撤销重做的历史记录
    undoHistory.value = []
    redoHistory.value = []
    currentBindBoardId = null
  } catch (err) {
    console.error('返回管理界面失败：', err)
  } finally {
    isLoading.value = false
  }
}

// 保存白板内容
const saveWhiteboard = async () => {
  const canvas = canvasInstance.value
  if (!canvas || !canvasReady.value) return

  isLoading.value = true
  try {
    const canvasContent = canvas.toJSON()
    const title = currentBoardTitle.value.trim() || `白板-${new Date().toLocaleString().slice(0, 10)}`

    if (isNewBoardFlag) {
      const createRes = await fetch('/api/whiteboard/new', { method: 'POST' })
      const createData = await createRes.json()
      currentBoardId.value = createData.boardId
      isNewBoardFlag = false
    }

    const saveRes = await fetch('/api/whiteboard/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId: currentBoardId.value,
        title,
        content: canvasContent
      })
    })
    const saveData = await saveRes.json()
    if (saveData.success) {
      alert('保存成功！')
      await fetchAllBoards()
    }
  } catch (err) {
    console.error('保存失败：', err)
    alert('保存失败，请检查后端是否启动')
  } finally {
    isLoading.value = false
  }
}

// 更新白板标题
const updateBoardTitle = async () => {
  if (isNewBoardFlag || !currentBoardId.value || !canvasReady.value) return
  try {
    await fetch('/api/whiteboard/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId: currentBoardId.value,
        title: currentBoardTitle.value.trim(),
        content: canvasInstance.value?.toJSON() || {}
      })
    })
  } catch (err) {
    console.error('更新标题失败：', err)
  }
}

// 切换绘图工具
const setTool = (toolType) => {
  const canvas = canvasInstance.value
  if (!canvas || !canvasReady.value) return

  // 重置画布的所有状态
  canvas.isDrawingMode = false
  canvas.selection = false
  canvas.discardActiveObject()
  // 移除所有鼠标事件监听，避免冲突
  canvas.off('mouse:down')
  canvas.off('mouse:move')
  canvas.off('mouse:up')
  canvas.off('mouse:out')
  canvas.off('mouse:in')
  canvas.off('object:selected')
  isDrawingShape = false
  currentDrawingShape = null
  shapeStartPoint = null

  // 重置光标样式
  canvasDom.style.cursor = 'default'

  currentTool.value = toolType

  // 选择工具模式
  if (toolType === 'select') {
    canvas.selection = true
    initSelectModeInteractions(canvas)
    canvasDom.style.cursor = 'default'
  }

  // 画笔工具模式
  else if (toolType === 'pen') {
    canvas.isDrawingMode = true
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
    canvas.freeDrawingBrush.width = currentStrokeWidth.value
    canvas.freeDrawingBrush.color = currentColor.value
    canvasDom.style.cursor = 'crosshair'
  }

  // 橡皮擦工具模式
  else if (toolType === 'eraser') {
    canvas.isDrawingMode = true
    // 用白色画笔模拟擦除效果（和画布背景色一致）
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas)
    canvas.freeDrawingBrush.width = currentStrokeWidth.value
    canvas.freeDrawingBrush.color = '#ffffff'
    canvasDom.style.cursor = 'crosshair'
  }

  // 文本工具模式
  else if (toolType === 'text') {
    canvas.selection = true
    canvas.on('mouse:down', (event) => {
      if (event.target) return
      const textElement = new fabric.IText('请输入内容', {
        left: event.pointer.x - 50,
        top: event.pointer.y - 15,
        fontSize: 22,
        fill: currentColor.value,
        editable: true,
        selectable: true
      })

      textElement.on('mousedblclick', () => {
        textElement.enterEditing()
        textElement.hiddenTextarea?.focus()
      })

      canvas.add(textElement)
      canvas.setActiveObject(textElement)
      setTimeout(() => {
        textElement.enterEditing()
        textElement.hiddenTextarea?.focus()
        textElement.on('editing:exited', () => {
          saveCanvasState()
          setTool('select')
        })
      }, 50)
    })
    canvasDom.style.cursor = 'text'
  }

  // 矩形工具模式
  else if (toolType === 'rect') {
    canvas.selection = false
    canvas.on('mouse:down', (event) => {
      isDrawingShape = true
      shapeStartPoint = canvas.getPointer(event.e)
      currentDrawingShape = new fabric.Rect({
        left: shapeStartPoint.x,
        top: shapeStartPoint.y,
        width: 0,
        height: 0,
        fill: '',
        stroke: currentColor.value,
        strokeWidth: currentStrokeWidth.value,
        strokeDashArray: isDashed.value ? [10, 5] : [],
        selectable: true
      })
      canvas.add(currentDrawingShape)
      canvas.setActiveObject(currentDrawingShape)
    })

    canvas.on('mouse:move', (event) => {
      if (!isDrawingShape || !currentDrawingShape) return
      const currentPoint = canvas.getPointer(event.e)
      const width = currentPoint.x - shapeStartPoint.x
      const height = currentPoint.y - shapeStartPoint.y
      currentDrawingShape.set({
        width: Math.abs(width),
        height: Math.abs(height),
        left: width < 0 ? currentPoint.x : shapeStartPoint.x,
        top: height < 0 ? currentPoint.y : shapeStartPoint.y
      })
      canvas.renderAll()
    })

    canvas.on('mouse:up', () => {
      isDrawingShape = false
      currentDrawingShape = null
      saveCanvasState()
    })
    canvasDom.style.cursor = 'crosshair'
  }

  // 圆形工具模式
  else if (toolType === 'circle') {
    canvas.selection = false
    canvas.on('mouse:down', (event) => {
      isDrawingShape = true
      shapeStartPoint = canvas.getPointer(event.e)
      currentDrawingShape = new fabric.Circle({
        left: shapeStartPoint.x,
        top: shapeStartPoint.y,
        radius: 0,
        fill: '',
        stroke: currentColor.value,
        strokeWidth: currentStrokeWidth.value,
        strokeDashArray: isDashed.value ? [10, 5] : [],
        selectable: true
      })
      canvas.add(currentDrawingShape)
      canvas.setActiveObject(currentDrawingShape)
    })

    canvas.on('mouse:move', (event) => {
      if (!isDrawingShape || !currentDrawingShape) return
      const currentPoint = canvas.getPointer(event.e)
      const radius = Math.sqrt(
        Math.pow(currentPoint.x - shapeStartPoint.x, 2) +
        Math.pow(currentPoint.y - shapeStartPoint.y, 2)
      )
      currentDrawingShape.set({ radius: radius })
      canvas.renderAll()
    })

    canvas.on('mouse:up', () => {
      isDrawingShape = false
      currentDrawingShape = null
      saveCanvasState()
    })
    canvasDom.style.cursor = 'crosshair'
  }

  // 线段工具模式
  else if (toolType === 'line') {
    canvas.selection = false
    canvas.on('mouse:down', (event) => {
      isDrawingShape = true
      shapeStartPoint = canvas.getPointer(event.e)
      currentDrawingShape = new fabric.Line(
        [shapeStartPoint.x, shapeStartPoint.y, shapeStartPoint.x, shapeStartPoint.y],
        {
          stroke: currentColor.value,
          strokeWidth: currentStrokeWidth.value,
          strokeDashArray: isDashed.value ? [10, 5] : [],
          selectable: true
        }
      )
      canvas.add(currentDrawingShape)
      canvas.setActiveObject(currentDrawingShape)
    })

    canvas.on('mouse:move', (event) => {
      if (!isDrawingShape || !currentDrawingShape) return
      const currentPoint = canvas.getPointer(event.e)
      currentDrawingShape.set({ x2: currentPoint.x, y2: currentPoint.y })
      canvas.renderAll()
    })

    canvas.on('mouse:up', () => {
      isDrawingShape = false
      currentDrawingShape = null
      saveCanvasState()
    })
    canvasDom.style.cursor = 'crosshair'
  }
}

// 选择模式的交互逻辑
const initSelectModeInteractions = (canvas) => {
  // 平移画布（按住Alt键拖动）
  canvas.on('mouse:down', (opt) => {
    if (opt.e.altKey) {
      isPanning = true
      lastPointer = canvas.getPointer(opt.e)
      canvas.selection = false
    }
  })

  canvas.on('mouse:move', (opt) => {
    if (!isPanning) return
    const pointer = canvas.getPointer(opt.e)
    canvas.viewportTransform[4] += pointer.x - lastPointer.x
    canvas.viewportTransform[5] += pointer.y - lastPointer.y
    lastPointer = pointer
    canvas.renderAll()
  })

  canvas.on('mouse:up', () => {
    if (isPanning) {
      isPanning = false
      canvas.selection = true
    }
  })

  // 文本双击编辑
  canvas.on('object:selected', (e) => {
    const obj = e.target
    if (obj.type === 'i-text') {
      obj.on('mousedblclick', () => {
        obj.enterEditing()
        obj.hiddenTextarea?.focus()
      })
    }
  })
}

// 删除选中的画布元素
const deleteActiveElement = () => {
  const canvas = canvasInstance.value
  if (!canvas || !canvasReady.value) return

  const activeObjects = canvas.getActiveObjects()
  if (activeObjects.length > 0) {
    saveCanvasState()
    canvas.remove(...activeObjects)
    canvas.discardActiveObject()
    canvas.renderAll()
  } else {
    const activeObject = canvas.getActiveObject()
    if (activeObject) {
      saveCanvasState()
      canvas.remove(activeObject)
      canvas.renderAll()
    }
  }
}

// 生成分享链接
const generateShareLink = async () => {
  const canvas = canvasInstance.value
  if (!canvas || !canvasReady.value) return

  // 新白板要先保存才能生成链接
  if (isNewBoardFlag || !currentBoardId.value) {
    alert('请先保存当前白板再生成分享链接')
    return
  }

  isLoading.value = true
  try {
    const res = await fetch(`/api/whiteboard/generate-share?boardId=${currentBoardId.value}`)
    const data = await res.json()

    if (!res.ok) throw new Error(data.message || '生成分享链接失败')
    if (data.shareId) {
      shareLink.value = `${window.location.origin}/share/${data.shareId}`
      alert('分享链接生成成功！点击输入框可复制')
    }
  } catch (err) {
    console.error('生成分享链接失败：', err)
    alert(err.message || '生成失败，请检查后端是否启动')
  } finally {
    isLoading.value = false
  }
}

// 复制分享链接到剪贴板
const copyToClipboard = () => {
  if (!shareLink.value) return
  
  navigator.clipboard.writeText(shareLink.value)
    .then(() => {
      copySuccess.value = true
      setTimeout(() => copySuccess.value = false, 2000)
    })
    .catch(() => {
      alert('复制失败，请手动复制链接')
    })
}

// 监听样式变化，实时更新画笔/橡皮擦样式
watch([currentColor, currentStrokeWidth, isDashed], () => {
  const canvas = canvasInstance.value
  if (!canvas) return
  
  // 更新画笔样式
  if (currentTool.value === 'pen') {
    canvas.freeDrawingBrush.color = currentColor.value
    canvas.freeDrawingBrush.width = currentStrokeWidth.value
  }
  // 更新橡皮擦大小
  else if (currentTool.value === 'eraser') {
    canvas.freeDrawingBrush.width = currentStrokeWidth.value
  }
})

// 键盘快捷键处理
const toolShortcuts = {
  'select': 'v',
  'pen': 'p',
  'eraser': 'e',
  'text': 't',
  'rect': 'r',
  'circle': 'c',
  'line': 'l'
}

const handleKeydown = (e) => {
  if (!canvasReady.value) return

  const isCtrl = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()

  // 撤销/重做的快捷键
  if (isCtrl) {
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    }
    if ((key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
    }
  }

  // 工具切换的快捷键
  if (!isCtrl && !e.metaKey && !e.altKey) {
    const tool = Object.keys(toolShortcuts).find(t => toolShortcuts[t] === key)
    if (tool) {
      e.preventDefault()
      setTool(tool)
    }
  }

  // 删除选中元素的快捷键
  if (key === 'delete' || key === 'backspace') {
    e.preventDefault()
    deleteActiveElement()
  }
}

// 监听工具切换，更新画布状态
watch(currentTool, (newTool) => {
  const canvas = canvasInstance.value
  if (canvas) {
    canvas.isDrawingMode = newTool === 'pen' || newTool === 'eraser'
    canvas.selection = newTool === 'select' || newTool === 'text'
  }
})
</script>

<style scoped>
/* 样式部分保持不变 */
html, body {
  touch-action: manipulation;
  overflow-x: hidden;
  -ms-content-zooming: none;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

.app-container {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 20px;
  font-family: "Microsoft Yahei", sans-serif;
}

.board-manager {
  background-color: #f9fafb;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.board-manager h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.primary-btn {
  background-color: #27ae60;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: background-color 0.2s;
}

.primary-btn:hover {
  background-color: #219653;
}

.board-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.board-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.board-info {
  flex: 1;
}

.board-title {
  font-size: 16px;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 4px;
}

.board-time {
  font-size: 12px;
  color: #95a5a6;
}

.board-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 14px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.import-btn {
  background-color: #3498db;
  color: white;
}

.import-btn:hover {
  background-color: #2980b9;
}

.delete-btn {
  background-color: #e74c3c;
  color: white;
}

.delete-btn:hover {
  background-color: #c0392b;
}

.empty-tip {
  text-align: center;
  padding: 30px;
  color: #7f8c8d;
  font-size: 16px;
}

.whiteboard-wrapper {
  position: relative;
}

.whiteboard-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 15px;
  padding: 14px 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  align-items: center;
  flex-wrap: wrap;
}

.style-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 10px;
  padding-left: 10px;
  border-left: 1px solid #ddd;
}

.color-picker {
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  cursor: pointer;
}

.stroke-width {
  width: 60px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.dashed-toggle {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.board-title-input {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  max-width: 300px;
  min-width: 150px;
}

.board-title-input:focus {
  outline: none;
  border-color: #3498db;
}

.toolbar-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background-color: #2c3e50;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.toolbar-btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
  transform: none;
}

.toolbar-btn:hover:not(:disabled) {
  background-color: #34495e;
  transform: translateY(-1px);
}

.toolbar-btn.active {
  background-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.3);
}

.canvas-container {
  overflow: hidden;
  border-radius: 8px;
}

.canvas-element {
  width: 100%;
  height: auto;
  border: 1px solid #e1e5eb;
  background-color: #ffffff;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  display: block;
  touch-action: manipulation;
  user-select: none;
  pointer-events: auto;
}

.canvas-tip {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  padding-left: 4px;
}

.zoom-info {
  font-size: 13px;
  color: #333;
  padding: 8px 12px;
  background-color: #f0f7ff;
  border-radius: 4px;
  white-space: nowrap;
}

.loading-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  color: #666;
  z-index: 100;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px 20px;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .whiteboard-toolbar {
    gap: 8px;
  }
  .toolbar-btn {
    padding: 8px 12px;
    font-size: 13px;
  }
  .style-controls {
    margin-top: 10px;
    border-left: none;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    width: 100%;
  }
  .zoom-info {
    padding: 6px 10px;
    font-size: 12px;
  }
}

.share-link-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;
}

.share-link-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  width: 300px;
  color: #3498db;
  cursor: pointer;
  background-color: #f8f9fa;
}

.share-link-input:focus {
  outline: none;
  border-color: #3498db;
}

.copy-tip {
  color: #27ae60;
  font-size: 13px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .share-link-wrap {
    margin-top: 10px;
    width: 100%;
  }
  .share-link-input {
    width: 100%;
  }
}
</style>