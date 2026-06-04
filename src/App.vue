<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { toBlob } from 'html-to-image'
import { extractColors } from 'extract-colors'
import { getChineseColorName,getVibeCopy } from './utils/color'
import { VibeStorage } from './utils/storage'
import VibeCard from './components/VibeCard.vue'

const cameraInput = ref(null)
const galleryInput = ref(null)

const vibeCardRef = ref(null) 
const currentTemplate = ref('classic') 
const status = ref('idle')

// 📖 6. 情绪手账 (Vibe Diary) 状态与逻辑
const diaryList = ref([])
const vibeReport = computed(() => {
  if (diaryList.value.length === 0) return null

  // 1. 统计颜色频次
  let colorCounts = {}
  diaryList.value.forEach(item => {
    item.palette.forEach(hex => {
      const name = getChineseColorName(hex)
      colorCounts[name] = (colorCounts[name] || 0) + 1
    })
  })

  // 2. 找出主打色
  let dominantColor = ''
  let maxCount = 0
  for (const [name, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantColor = name
    }
  }

  // 3. 直接调用 color.js 里的方法获取专属文案
  return {
    colorName: dominantColor,
    copy: getVibeCopy(dominantColor),
    count: diaryList.value.length
  }
})

async function openDiary() {
  vibrate(10)
  const storedList = await VibeStorage.get('vibe_diary') 
  diaryList.value = storedList || []
  status.value = 'diary'
}

// 💡 修改：变成 async 函数
async function addToDiary() {
  let currentList = await VibeStorage.get('vibe_diary') || []

  const newItem = {
    id: Date.now(),
    date: new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    image: aiPayloadImage.value,
    palette: [...palette.value],
    playlistName: playlistName.value,
    bilingualCopy: bilingualCopy.value,
    isDark: isDarkMode.value 
  }
  
  currentList.unshift(newItem) 
  if (currentList.length > 15) currentList = currentList.slice(0, 15)
  
  // 💡 修改：使用 await 写入，并用 while 循环解决爆盘问题
  let isSaved = false
  while (!isSaved && currentList.length > 0) {
    try {
      await VibeStorage.set('vibe_diary', currentList) // 调用适配器
      diaryList.value = currentList
      isSaved = true 
    } catch (e) {
      console.warn('存储空间超限，自动丢弃一条最旧的记录...')
      currentList.pop() 
    }
  }

  if (!isSaved) diaryList.value = [newItem]
}

const displayImageUrl = ref('') 
const aiPayloadImage = ref('')
const isSaving = ref(false)
const isRegenerating = ref(false) 

const palette = ref(['#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'])
const playlistName = ref('正在感知氛围...')
const bilingualCopy = ref('解析光影频率 / Decoding light frequencies.')
const emojis = ref(['✨', '⏳', '🌫️'])

const scanTexts = ['正在提取光影...', '感受色彩温度...', '生成情绪波形...']
const currentScanTextIndex = ref(0)
let scanInterval = null

function vibrate(pattern = 15) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch(e) {}
  }
}

function getLuminance(hex) {
  let r = parseInt(hex.slice(1, 3), 16) || 0
  let g = parseInt(hex.slice(3, 5), 16) || 0
  let b = parseInt(hex.slice(5, 7), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const themeOverride = ref(null) 

const isDarkMode = computed(() => {
  if (themeOverride.value !== null) return themeOverride.value === 'dark'
  if (!palette.value.length) return false
  const totalLum = palette.value.reduce((acc, color) => acc + getLuminance(color), 0)
  const avgLum = totalLum / palette.value.length
  return avgLum < 0.5
})

function toggleTheme() {
  vibrate(10)
  document.activeElement?.blur()
  themeOverride.value = isDarkMode.value ? 'light' : 'dark'
}

function compressImage(file, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file) 
    img.src = objectUrl

    img.onload = () => {
      URL.revokeObjectURL(objectUrl) 
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'low' 
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/webp', 0.6))
    }
    img.onerror = e => reject(e)
  })
}

async function fetchVibeFromAI(base64Image, hexColors) {
  const prompt = `你是一个拥有极高审美的情绪感知专家。请分析这张图片，并结合我刚刚提取出的图片主色调（${hexColors.join(', ')}），为其生成具有杂志感和氛围感的文案。请严格按照以下 JSON 格式返回，不要输出 markdown 标记：
{
  "playlistName": "一个带有诗意和情绪的独立音乐歌单名，例如：适合在雨天发呆的 Lo-Fi",
  "bilingualCopy": "一句极其克制、高级的中英双语朋友圈文案，例如：在城市的缝隙里呼吸 / Breathing in the cracks of the city.",
  "emojis": ["🌧️", "☕", "🎧"] 
}`

  try {
    const response = await fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "qwen3.7-plus",//大模型
        response_format: { type: "json_object" }, 
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }]
      })
    })
    
    if (!response.ok) throw new Error(`后端接口报错: HTTP ${response.status}`)
    const data = await response.json()
    if (data.choices && data.choices[0]) {
      let rawContent = data.choices[0].message.content
      // 🚀 核心修复：用正则强行剥离大模型可能吐出的 markdown 代码块标记
      rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim()
      return JSON.parse(rawContent)
    }
  } catch (e) {
    console.error("AI 接口调用崩溃:", e)
    return null
  }
}

function openCamera() { vibrate(20); cameraInput.value?.click() }
function openGallery() { vibrate(20); galleryInput.value?.click() }

async function handleUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  themeOverride.value = null 
  vibrate([15, 30, 15]) 
  status.value = 'scanning'
  currentScanTextIndex.value = 0
  
  try {
    if (displayImageUrl.value) {
      URL.revokeObjectURL(displayImageUrl.value)
    }
    displayImageUrl.value = URL.createObjectURL(file)
    await new Promise(resolve => setTimeout(resolve, 50))
    aiPayloadImage.value = await compressImage(file)
  } catch(e) {
    alert('读取图片失败！')
    return
  }

  scanInterval = window.setInterval(() => {
    currentScanTextIndex.value = (currentScanTextIndex.value + 1) % scanTexts.length
  }, 800)

  const waitAnimation = new Promise(resolve => setTimeout(resolve, 3000))

  const dataPipeline = (async () => {
    let extractedHex = []
    try {
      //压缩后的图
      const colors = await extractColors(aiPayloadImage.value)
      extractedHex = colors.slice(0, 5).map(c => c.hex.toUpperCase())
      while (extractedHex.length < 5 && extractedHex.length > 0) {
        extractedHex.push(extractedHex[extractedHex.length - 1])
      }
      if (extractedHex.length > 0) palette.value = extractedHex
    } catch(e) {}
    
    return await fetchVibeFromAI(aiPayloadImage.value, extractedHex)
  })()

  try {
    const [_, aiResult] = await Promise.all([waitAnimation, dataPipeline])
    if (aiResult) {
      playlistName.value = aiResult.playlistName || '未知的情绪波段'
      bilingualCopy.value = aiResult.bilingualCopy || '无法解析的氛围 / Unresolved vibe.'
      emojis.value = aiResult.emojis || ['✨', '🤍', '🌫️']
      vibrate([20, 50]) 
    }
  } catch (e) {
  } finally {
    clearInterval(scanInterval)
    status.value = 'result'
  }
}

async function regenerateVibe() {
  if (isRegenerating.value || !aiPayloadImage.value) return 
  vibrate(15)
  isRegenerating.value = true
  
  try {
    const aiResult = await fetchVibeFromAI(aiPayloadImage.value, palette.value) 
    if (aiResult) {
      playlistName.value = aiResult.playlistName || playlistName.value
      bilingualCopy.value = aiResult.bilingualCopy || bilingualCopy.value
      emojis.value = aiResult.emojis || emojis.value
      vibrate([15, 30]) 
    }
  } finally {
    isRegenerating.value = false
  }
}

const isCardReadonly = computed(() => isSaving.value || status.value === 'preview')

function goToPreview() {
  vibrate(10)
  document.activeElement?.blur() 
  status.value = 'preview'
}

function goBackToEdit() {
  vibrate(10)
  status.value = 'result'
}

async function saveCard() {
  // 💡 3. 核心变化：截图时，向子组件内部请求真实的 DOM 节点
  if (!vibeCardRef.value || isSaving.value) return
  vibrate(15)
  isSaving.value = true
  document.activeElement?.blur()
  
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const targetDOM = vibeCardRef.value.cardElement // 获取子组件暴露的 DOM

    const captureOptions = {
      pixelRatio: 3, 
      backgroundColor: isDarkMode.value && currentTemplate.value === 'classic' ? '#111827' : '#F9FAFB', // 智能切换背景色
      style: { transform: 'scale(1)' }
    }

    try { await toBlob(targetDOM, captureOptions) } catch (e) {}

    const blob = await toBlob(targetDOM, captureOptions)
    if (!blob) throw new Error('DOM 渲染 Blob 失败')

    vibrate([30, 50]) 
    addToDiary() 
    const fileName = `VibeCard_${Date.now()}.png`
    const file = new File([blob], fileName, { type: 'image/png' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: '氛围感取色器', text: `万物皆有氛围 | ${playlistName.value}`, files: [file] })
      } catch (e) { if (e.name !== 'AbortError') throw e }
    } else {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName; link.href = url; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  } catch (err) {
    alert(`保存失败: ${err.message || err.name}`)
  } finally {
    isSaving.value = false
  }
}

function reset() {
  vibrate(10)
  themeOverride.value = null 
  status.value = 'idle'
  
  if (displayImageUrl.value) {
    URL.revokeObjectURL(displayImageUrl.value)
    displayImageUrl.value = ''
  }
  aiPayloadImage.value = ''
  
  if (cameraInput.value) cameraInput.value.value = ''
  if (galleryInput.value) galleryInput.value.value = ''
}

onBeforeUnmount(() => { if (scanInterval) clearInterval(scanInterval) })
</script>

<template>
  <div class="fixed inset-0 -z-10 bg-[#F9FAFB] transition-colors duration-1000 overflow-hidden">
    <div v-if="status === 'idle'" class="absolute inset-0 pointer-events-none opacity-60 transition-opacity duration-1000">
      <div class="absolute top-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob"></div>
      <div class="absolute top-[20%] right-[-10%] w-[25rem] h-[25rem] bg-pink-200/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob" style="animation-delay: 2s;"></div>
      <div class="absolute bottom-[-10%] left-[20%] w-[35rem] h-[35rem] bg-purple-200/30 rounded-full mix-blend-multiply filter blur-[100px] animate-blob" style="animation-delay: 4s;"></div>
    </div>

    <div v-if="status !== 'idle' && displayImageUrl" class="absolute inset-0 transition-opacity duration-1000 opacity-100">
      <img :src="displayImageUrl" class="absolute inset-0 w-full h-full object-cover scale-110 opacity-30" alt="bg-blur" />
      <div class="absolute inset-0 backdrop-blur-3xl bg-white/50" :class="isDarkMode ? 'bg-black/70' : 'bg-white/50'"></div>
    </div>
  </div>

  <main class="min-h-[100dvh] overflow-hidden px-6 py-10 relative z-10 flex flex-col" :class="isDarkMode ? 'text-gray-100' : 'text-gray-800'">
    <input ref="cameraInput" class="sr-only" type="file" accept="image/*" capture="environment" @change="handleUpload" />
    <input ref="galleryInput" class="sr-only" type="file" accept="image/*" @change="handleUpload" />

    <section class="mx-auto flex flex-1 w-full max-w-sm flex-col items-center justify-center">
      
      <div v-if="status === 'idle'" class="flex w-full flex-col items-center text-center animate-fade-in relative z-10">
        <div class="mb-12 flex flex-col items-center">
          <p class="mb-3 text-[0.6rem] tracking-[0.4em] text-gray-400/70 font-mono uppercase">Capture The Vibe</p>
          <h1 class="font-serif text-[2.75rem] tracking-wide text-gray-900 leading-none mb-4">氛围感取色器</h1>
          <p class="text-[0.75rem] font-light text-gray-400 tracking-[0.2em]">万物皆有氛围</p>
        </div>

        <div class="animate-float mt-8 flex gap-5 w-full justify-center">
          <button @click="openCamera" class="group relative flex h-36 w-32 flex-col items-center justify-center rounded-[2rem] border-[0.5px] border-white/80 bg-white/30 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all duration-500 hover:scale-105 hover:bg-white/50 hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] active:scale-95">
            <span class="text-3xl mb-3 transition-transform group-hover:scale-110">📷</span>
            <span class="text-[0.65rem] tracking-[0.15em] text-gray-500 group-hover:text-gray-800">捕捉此刻</span>
          </button>

          <button @click="openGallery" class="group relative flex h-36 w-32 flex-col items-center justify-center rounded-[2rem] border-[0.5px] border-white/80 bg-white/30 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all duration-500 hover:scale-105 hover:bg-white/50 hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] active:scale-95">
            <span class="text-3xl mb-3 transition-transform group-hover:scale-110">🖼️</span>
            <span class="text-[0.65rem] tracking-[0.15em] text-gray-500 group-hover:text-gray-800">读取相册</span>
          </button>
        </div>
        <div class="mt-12 flex justify-center w-full animate-fade-in" style="animation-delay: 0.3s;">
          <button @click="openDiary" class="flex items-center gap-2 text-[0.7rem] tracking-[0.2em] text-gray-400 hover:text-gray-700 transition-colors uppercase">
            <svg class="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
            我的情绪手账
          </button>
        </div>
      </div>
      
      <div v-else-if="status === 'scanning'" class="flex w-full flex-col items-center gap-10">
        <div class="relative w-64 h-[22rem] overflow-hidden rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/60">
          <img :src="displayImageUrl" class="h-full w-full object-cover" />
          <div class="absolute inset-0 bg-black/10"></div>
          <div class="scan-line absolute left-0 right-0 top-0 h-32"></div>
        </div>
        <div class="h-8 flex items-center justify-center">
          <transition name="fade" mode="out-in">
            <p :key="currentScanTextIndex" class="font-serif text-lg tracking-widest text-gray-800/80" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
              {{ scanTexts[currentScanTextIndex] }}
            </p>
          </transition>
        </div>
      </div>

      <div v-else-if="status === 'result' || status === 'preview'" class="flex w-full flex-col items-center animate-fade-in">
        
        <VibeCard
          ref="vibeCardRef"
          :templateType="currentTemplate"
          :image="displayImageUrl"
          v-model:palette="palette"
          v-model:playlistName="playlistName"
          v-model:bilingualCopy="bilingualCopy"
          v-model:emojis="emojis"
          :isDarkMode="isDarkMode"
          :isCardReadonly="isCardReadonly"
          :isRegenerating="isRegenerating"
          :status="status"
          @toggleTheme="toggleTheme"
          @regenerate="regenerateVibe"
        />

        <div v-if="!isCardReadonly" class="mt-6 flex gap-2 p-1.5 rounded-full transition-colors" :class="isDarkMode ? 'bg-white/10' : 'bg-black/5'">
          <button @click="currentTemplate = 'classic'; vibrate(10)" class="px-5 py-1.5 rounded-full text-xs font-medium transition-all" :class="currentTemplate === 'classic' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">经典</button>
          <button @click="currentTemplate = 'polaroid'; vibrate(10)" class="px-5 py-1.5 rounded-full text-xs font-medium transition-all" :class="currentTemplate === 'polaroid' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">拍立得</button>
          <button @click="currentTemplate = 'magazine'; vibrate(10)" class="px-5 py-1.5 rounded-full text-xs font-medium transition-all" :class="currentTemplate === 'magazine' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">杂志</button>
        </div>

        <p v-if="status === 'result'" class="mt-4 text-[0.55rem] tracking-[0.1em] text-center animate-pulse" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
          ✨ 点击文案/色块修改，左上角切换明暗
        </p>
        <p v-else class="mt-5 text-[0.55rem] tracking-[0.1em] text-center" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
          👁️ 预览模式：保存后的卡片效果如上所示
        </p>

        <div v-if="status === 'result'" class="mt-4 flex w-full gap-4 px-2">
          <button
            type="button"
            class="h-14 flex-1 rounded-full text-sm tracking-widest shadow-md transition-all active:scale-95 border"
            :class="isDarkMode ? 'bg-gray-100 text-gray-900 border-transparent hover:bg-white' : 'bg-gray-900 text-white border-transparent hover:bg-gray-800'"
            @click="goToPreview"
          >下一步</button>
          
          <button
            type="button"
            class="h-14 w-24 flex-shrink-0 rounded-full border text-sm tracking-widest shadow-sm backdrop-blur-md transition-all active:scale-95"
            :class="isDarkMode ? 'border-white/20 bg-gray-900/50 text-gray-300 hover:bg-gray-800' : 'border-gray-900/10 bg-white/50 text-gray-600 hover:bg-white'"
            @click="reset"
          >重选</button>
        </div>

        <div v-if="status === 'preview'" class="mt-4 flex w-full gap-4 px-2">
          <button
            type="button"
            class="h-14 flex-1 rounded-full text-sm tracking-widest shadow-md transition-all active:scale-95 border"
            :class="isDarkMode ? 'bg-gray-100 text-gray-900 border-transparent hover:bg-white' : 'bg-gray-900 text-white border-transparent hover:bg-gray-800'"
            @click="saveCard"
          >{{ isSaving ? 'SAVING...' : '保存卡片' }}</button>
          
          <button
            type="button"
            class="h-14 w-24 flex-shrink-0 rounded-full border text-sm tracking-widest shadow-sm backdrop-blur-md transition-all active:scale-95"
            :class="isDarkMode ? 'border-white/20 bg-gray-900/50 text-gray-300 hover:bg-gray-800' : 'border-gray-900/10 bg-white/50 text-gray-600 hover:bg-white'"
            @click="goBackToEdit"
          >上一步</button>
        </div>
      </div>
      
      <div v-else-if="status === 'diary'" class="flex w-full h-[85vh] flex-col animate-fade-in relative z-10">
        <div class="flex justify-between items-center mb-6 px-2">
          <div class="flex flex-col">
            <h2 class="font-serif text-2xl tracking-widest text-gray-900">情绪手账</h2>
            <span class="text-[0.6rem] tracking-[0.2em] text-gray-400 uppercase mt-1">Vibe Diary</span>
          </div>
          <button @click="status = 'idle'" class="p-2 text-[0.7rem] tracking-widest text-gray-500 hover:text-gray-800 active:scale-95 transition-all">返回</button>
        </div>
        
        <div class="flex-1 overflow-y-auto px-1 pb-10 space-y-5" style="scrollbar-width: none;">
          
          <div v-if="vibeReport" class="p-5 rounded-[1.5rem] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-md mb-2 shadow-sm transition-all">
            <h3 class="text-[0.65rem] font-mono tracking-widest text-indigo-500/80 mb-2 uppercase">Vibe Insights</h3>
            <p class="text-[0.8rem] text-gray-700 leading-relaxed font-serif" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
              在最近的 {{ vibeReport.count }} 个瞬间里，你的主打色是 <span class="font-bold text-indigo-500">#{{ vibeReport.colorName }}</span>。<br/>
              <span class="opacity-80 text-[0.7rem] italic mt-1 inline-block">{{ vibeReport.copy }}</span>
            </p>
          </div>
          
          <div v-if="!diaryList.length" class="text-center text-xs mt-32 opacity-50 font-light tracking-widest text-gray-500">
            暂无记录，去捕捉你的第一道光影吧。
          </div>
          <div v-for="item in diaryList" :key="item.id" 
               class="p-4 rounded-[1.5rem] flex gap-4 backdrop-blur-xl border shadow-sm transition-all hover:scale-[1.02]"
               :class="item.isDark ? 'bg-gray-900/70 border-white/10 text-gray-200' : 'bg-white/60 border-white/50 text-gray-800'">
            <img :src="item.image" class="w-20 h-24 object-cover rounded-xl shadow-sm opacity-90" />
            <div class="flex flex-col flex-1 justify-between py-1 overflow-hidden">
              <div>
                <div class="text-[0.6rem] opacity-60 font-mono mb-1.5">{{ item.date }}</div>
                <div class="font-serif text-sm font-medium leading-tight overflow-hidden text-ellipsis display-webkit-box" style="-webkit-line-clamp: 2; -webkit-box-orient: vertical; display: -webkit-box;">
                  {{ item.playlistName }}
                </div>
              </div>
              <div class="flex h-2.5 w-full rounded-md overflow-hidden mt-3 opacity-90 shadow-inner">
                <div v-for="c in item.palette" :key="c" :style="{ backgroundColor: c }" class="flex-1"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.fade-enter-from { opacity: 0; transform: translateY(8px); }
.fade-leave-to { opacity: 0; transform: translateY(-8px); }
.animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>