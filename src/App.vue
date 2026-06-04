<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { toBlob } from 'html-to-image'
import { extractColors } from 'extract-colors'
import { getChineseColorName } from './utils/color'
// 📸 1. 拆分上传 Ref，支持直接唤起相机
const cameraInput = ref(null)
const galleryInput = ref(null)
const cardRef = ref(null)

const status = ref('idle')
// 🖼️ 1. 用于界面高清展示和最终保存的本地原图指针
const displayImageUrl = ref('') 
// 🤖 2. 用于发给 AI 解析的极度压缩（马赛克）图片 Base64
const aiPayloadImage = ref('')
const isSaving = ref(false)
const isRegenerating = ref(false) // 🔄 灵感刷新状态

const palette = ref(['#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'])
const playlistName = ref('正在感知氛围...')
const bilingualCopy = ref('解析光影频率 / Decoding light frequencies.')
const emojis = ref(['✨', '⏳', '🌫️'])

const scanTexts = ['正在提取光影...', '感受色彩温度...', '生成情绪波形...']
const currentScanTextIndex = ref(0)
let scanInterval = null

// 📳 2. 物理级触觉引擎 (Haptic Feedback)
function vibrate(pattern = 15) {
  // 检查浏览器是否支持震动 API（Android 完美支持，iOS 仅部分 PWA 支持）
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch(e) {}
  }
}

// 🌓 3. 核心算法：计算色彩亮度，智能切换暗黑模式
function getLuminance(hex) {
  let r = parseInt(hex.slice(1, 3), 16) || 0
  let g = parseInt(hex.slice(3, 5), 16) || 0
  let b = parseInt(hex.slice(5, 7), 16) || 0
  // 相对亮度公式 (Relative Luminance)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const themeOverride = ref(null) // 🌓 新增：记录用户的手动选择

const isDarkMode = computed(() => {
  // 1. 如果用户手动点击过，优先强制听用户的
  if (themeOverride.value !== null) return themeOverride.value === 'dark'
  
  // 2. 否则，保持原有的智能色彩亮度自适应
  if (!palette.value.length) return false
  const totalLum = palette.value.reduce((acc, color) => acc + getLuminance(color), 0)
  const avgLum = totalLum / palette.value.length
  return avgLum < 0.5
})

// 🌓 新增：手动切换主题的触发函数
function toggleTheme() {
  vibrate(10)
  themeOverride.value = isDarkMode.value ? 'light' : 'dark'
}

// 压缩至极致体积，专供 AI 读取（不影响页面展示）
function compressImage(file, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
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
        ctx.drawImage(img, 0, 0, width, height)
        // 核心优化：改为 webp 格式，质量 0.6，体积缩小数十倍
        resolve(canvas.toDataURL('image/webp', 0.6))
      }
      img.onerror = e => reject(e)
    }
    reader.onerror = e => reject(e)
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "qwen-vl-max",
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
    
    const data = await response.json()
    if (data.choices && data.choices[0]) {
      return JSON.parse(data.choices[0].message.content)
    }
  } catch (e) {
    console.error("AI 接口调用崩溃:", e)
    return null
  }
}

// 📸 唤起摄像头与图库
function openCamera() { vibrate(20); cameraInput.value?.click() }
function openGallery() { vibrate(20); galleryInput.value?.click() }

async function handleUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  themeOverride.value = null // 🌓 新增：每次上传新图片时重置主题选择
  vibrate([15, 30, 15]) // 扫码启动的震动反馈
  status.value = 'scanning'
  currentScanTextIndex.value = 0
  
  try {
    // 路线 A：秒级生成高清无损本地链接，供页面直接渲染
    displayImageUrl.value = URL.createObjectURL(file)
    // 路线 B：后台静默进行极限压缩，供 AI 解析
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
      // 提取颜色用高清图，保证色彩精准度
      const colors = await extractColors(displayImageUrl.value)
      extractedHex = colors.slice(0, 5).map(c => c.hex.toUpperCase())
      while (extractedHex.length < 5 && extractedHex.length > 0) {
        extractedHex.push(extractedHex[extractedHex.length - 1])
      }
      if (extractedHex.length > 0) palette.value = extractedHex
    } catch(e) {}
    
    // 发给 AI 的是极限压缩后的 aiPayloadImage
    return await fetchVibeFromAI(aiPayloadImage.value, extractedHex)
  })()

  try {
    const [_, aiResult] = await Promise.all([waitAnimation, dataPipeline])
    if (aiResult) {
      playlistName.value = aiResult.playlistName || '未知的情绪波段'
      bilingualCopy.value = aiResult.bilingualCopy || '无法解析的氛围 / Unresolved vibe.'
      emojis.value = aiResult.emojis || ['✨', '🤍', '🌫️']
      vibrate([20, 50]) // 成功震动
    }
  } catch (e) {
  } finally {
    clearInterval(scanInterval)
    status.value = 'result'
  }
}

// 🔄 4. 灵感刷新 (无缝重新请求 AI)
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
      vibrate([15, 30]) // 刷新成功震动
    }
  } finally {
    isRegenerating.value = false
  }
}


// 👁️ 5. 新增：预览模式状态控制
// 只要在“保存中”或者“预览页”，卡片就进入纯净的只读模式，隐藏所有操作按钮
const isCardReadonly = computed(() => isSaving.value || status.value === 'preview')

function goToPreview() {
  vibrate(10)
  document.activeElement?.blur() // 强制收起键盘并取消焦点
  status.value = 'preview'
}

function goBackToEdit() {
  vibrate(10)
  status.value = 'result'
}

async function saveCard() {
  if (!cardRef.value || isSaving.value) return
  vibrate(15)
  isSaving.value = true
  document.activeElement?.blur()
  
  try {
    await new Promise(resolve => setTimeout(resolve, 300))

    const captureOptions = {
      pixelRatio: 3, 
      backgroundColor: isDarkMode.value ? '#111827' : '#F9FAFB', // 保存时背景色智能匹配
      style: { transform: 'scale(1)' }
    }

    try { await toBlob(cardRef.value, captureOptions) } catch (e) {}

    const blob = await toBlob(cardRef.value, captureOptions)
    if (!blob) throw new Error('DOM 渲染 Blob 失败')

    vibrate([30, 50]) // 截图成功震动
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
  
  // 新增：释放高清图片的内存，并清空变量
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
        <article
          ref="cardRef"
          class="relative w-full rounded-[2.5rem] border p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-colors duration-700"
          :class="isDarkMode ? 'bg-gray-900/80 border-white/10' : 'bg-white/60 border-white/50'"
        >
          <button 
            v-if="!isCardReadonly"
            @click="toggleTheme"
            class="absolute top-5 left-5 p-2 rounded-full transition-all active:scale-90"
            :class="[isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-400']"
          >
            <svg v-if="isDarkMode" class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <svg v-else class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </button>
          
          <button 
            v-if="!isCardReadonly"
            @click="regenerateVibe"
            class="absolute top-5 right-5 p-2 rounded-full transition-all active:scale-90"
            :class="[isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-400']"
          >
            <svg v-if="!isRegenerating" class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <svg v-else class="h-[1.1rem] w-[1.1rem] animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          </button>

          <div class="mb-5 flex justify-center">
             <span class="text-[0.6rem] tracking-widest uppercase font-mono" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">Vibe Card</span>
          </div>

          <img :src="displayImageUrl" crossorigin="anonymous" class="h-72 w-full rounded-[1.5rem] object-cover shadow-sm" />

          <div class="mt-6 flex h-10 w-full overflow-hidden rounded-xl shadow-inner border" :class="isDarkMode ? 'border-white/10' : 'border-black/5'">
            <div v-for="(color, index) in palette" :key="`block-${index}`" class="relative flex-1 transition-colors duration-300" :style="{ backgroundColor: color }">
              <input v-if="status === 'result'" type="color" :value="color" @input="palette[index] = $event.target.value.toUpperCase(); vibrate(10)" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
            
            <button v-if="palette.length < 7 && !isCardReadonly" @click="palette.push('#E5E7EB'); vibrate(15)" class="flex w-8 items-center justify-center transition-colors active:scale-90" :class="isDarkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-black/5 text-gray-400 hover:bg-black/10'">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div class="mt-2 flex w-full px-1 text-[0.65rem] font-serif" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
            <div v-for="(color, index) in palette" :key="`label-${index}`" class="flex-1 flex justify-center items-center">
              <span class="tracking-[0.15em] opacity-80">{{ getChineseColorName(color) }}</span>
              <button v-if="palette.length > 2 && !isCardReadonly" @click="palette.splice(index, 1); vibrate(15)" class="ml-[2px] pb-[1px] text-[0.6rem] hover:text-red-400 transition-all font-sans">&times;</button>
            </div>
            <div v-if="palette.length < 7 && !isCardReadonly" class="w-8"></div>
          </div>

          <div class="px-2 pb-2 pt-8 text-center transition-colors duration-500">
            <h2 
              class="font-serif text-[1.35rem] font-medium tracking-wide leading-relaxed outline-none rounded-lg px-2 py-1 transition-colors"
              :class="[
                isDarkMode ? 'text-gray-100' : 'text-gray-900',
                status === 'result' ? (isDarkMode ? 'focus:bg-white/10 cursor-text' : 'focus:bg-black/5 cursor-text') : ''
              ]"
              :contenteditable="status === 'result'" spellcheck="false"
              @blur="playlistName = $event.target.innerText; vibrate(10)" @keydown.enter.prevent="$event.target.blur()"
            >{{ playlistName }}</h2>
            
            <p 
              class="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed font-light outline-none rounded-lg px-2 py-1 transition-colors"
              :class="[
                isDarkMode ? 'text-gray-400' : 'text-gray-500',
                status === 'result' ? (isDarkMode ? 'focus:bg-white/10 cursor-text' : 'focus:bg-black/5 cursor-text') : ''
              ]"
              :contenteditable="status === 'result'" spellcheck="false" @blur="bilingualCopy = $event.target.innerText; vibrate(10)"
            >{{ bilingualCopy }}</p>
            
            <div class="mt-6 flex justify-center items-center gap-4 text-xl opacity-80 filter grayscale-[20%]">
              <span 
                v-for="(emoji, index) in emojis" :key="`emoji-${index}`"
                class="outline-none rounded-lg px-1 py-0.5 transition-all min-w-[1.5rem] text-center"
                :class="status === 'result' ? (isDarkMode ? 'focus:bg-white/10 cursor-text' : 'focus:bg-black/5 cursor-text') : ''"
                :contenteditable="status === 'result'" spellcheck="false"
                @blur="$event.target.innerText.trim() ? (emojis[index] = $event.target.innerText.trim()) : emojis.splice(index, 1); vibrate(10)"
                @keydown.enter.prevent="$event.target.blur()"
              >{{ emoji }}</span>
              
              <button v-if="emojis.length < 6 && !isCardReadonly" @click="emojis.push('✨'); vibrate(15)" class="flex items-center justify-center text-gray-400 hover:scale-110 active:scale-90 transition-all">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
        </article>

        <p v-if="status === 'result'" class="mt-5 text-[0.55rem] tracking-[0.1em] text-center animate-pulse" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
          ✨ 点击文字/色块修改，左上角切换明暗
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