<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { toBlob } from 'html-to-image'
import { extractColors } from 'extract-colors'
import { getChineseColorName,getVibeCopy } from './utils/color'
import { VibeStorage } from './utils/storage'
import VibeCard from './components/VibeCard.vue'
import VibeDiary from './components/VibeDiary.vue'

const cameraInput = ref(null)
const galleryInput = ref(null)

const vibeCardRef = ref(null) 
const currentTemplate = ref('classic') 
const status = ref('idle')

const MAX_DIARY_ITEMS = 30

const COPY_STYLES = [
  {
    id: 'classic',
    name: '克制杂志',
    promptName: '克制杂志',
    playlistGuide: '像独立杂志里的音乐栏目，克制、干净、有留白。',
    copyGuide: '中文短句要高级但不端着，英文自然、有呼吸感。',
    emojiGuide: '选择低饱和、安静、轻盈的 emoji。'
  },
  {
    id: 'healing',
    name: '温柔治愈',
    promptName: '温柔治愈',
    playlistGuide: '像睡前电台或晨间散步歌单，柔软、安心、带一点光。',
    copyGuide: '中文要像一句轻声安慰，英文温暖自然，不鸡汤。',
    emojiGuide: '选择柔和、自然、温暖的 emoji。'
  },
  {
    id: 'film',
    name: '冷感胶片',
    promptName: '冷感胶片',
    playlistGuide: '像低饱和胶片、城市阴天、旧车窗里的歌单名。',
    copyGuide: '中文短、冷、带画面感；英文像独立电影旁白。',
    emojiGuide: '选择胶片、城市、雨雾、月光相关的 emoji。'
  },
  {
    id: 'playful',
    name: '轻微发疯',
    promptName: '轻微发疯文学',
    playlistGuide: '像有点离谱但可爱的私人歌单，俏皮、灵动、不低俗。',
    copyGuide: '中文可以轻微发疯但要短、有趣、不冒犯；英文要像朋友的灵光一闪。',
    emojiGuide: '选择活泼、意外、有小表情的 emoji。'
  },
  {
    id: 'travel',
    name: '旅行漫游',
    promptName: '旅行漫游',
    playlistGuide: '像车窗、海边、航站楼、陌生街角里的旅行歌单。',
    copyGuide: '中文有在路上的松弛感，英文像自然的旅行手记。',
    emojiGuide: '选择路途、天气、地图、海风相关的 emoji。'
  },
  {
    id: 'midnight',
    name: '夜晚独处',
    promptName: '夜晚独处',
    playlistGuide: '像凌晨、房间灯光、城市噪音退后之后的歌单。',
    copyGuide: '中文安静、私密、略带孤独但不丧；英文自然、低声。',
    emojiGuide: '选择夜晚、月亮、窗、耳机、微光相关的 emoji。'
  }
]

const selectedStyleId = ref('classic')

function getCopyStyle(styleId) {
  return COPY_STYLES.find(style => style.id === styleId) || COPY_STYLES[0]
}

const selectedCopyStyle = computed(() => getCopyStyle(selectedStyleId.value))

function selectCopyStyle(styleId) {
  if (!COPY_STYLES.some(style => style.id === styleId)) return
  selectedStyleId.value = styleId
  vibrate(8)
}

const diaryList = ref([])

function normalizeHexColor(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : ''
}

function normalizePalette(colors) {
  const normalized = Array.isArray(colors)
    ? colors.map(normalizeHexColor).filter(Boolean)
    : []

  return normalized.length ? normalized.slice(0, 7) : ['#E5E7EB']
}

function parseDiaryDate(item = {}) {
  const createdAt = new Date(item.createdAt)
  if (!Number.isNaN(createdAt.getTime())) return createdAt

  if (typeof item.id === 'number' && item.id > 0) {
    const idDate = new Date(item.id)
    if (!Number.isNaN(idDate.getTime())) return idDate
  }

  if (typeof item.id === 'string' && /^\d{10,}$/.test(item.id)) {
    const idDate = new Date(Number(item.id))
    if (!Number.isNaN(idDate.getTime())) return idDate
  }

  if (typeof item.date === 'string') {
    const match = item.date.match(/(\d{1,2})月(\d{1,2})日(?:.*?(\d{1,2}):(\d{2}))?/)
    if (match) {
      const fallbackDate = new Date()
      fallbackDate.setMonth(Number(match[1]) - 1)
      fallbackDate.setDate(Number(match[2]))
      fallbackDate.setHours(Number(match[3] || 12), Number(match[4] || 0), 0, 0)
      return fallbackDate
    }
  }

  return new Date()
}

function formatDiaryDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function getWeekStart(date) {
  const weekStart = startOfDay(date)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  return weekStart
}

function isSameMonth(date, baseDate = new Date()) {
  return date.getFullYear() === baseDate.getFullYear() && date.getMonth() === baseDate.getMonth()
}

function normalizeDiaryItem(item, index = 0) {
  const source = item && typeof item === 'object' ? item : {}
  const createdDate = parseDiaryDate(source)
  const createdAt = createdDate.toISOString()
  const normalizedPalette = normalizePalette(source.palette)
  const dominantColorName = source.dominantColorName || getChineseColorName(normalizedPalette[0])
  const style = getCopyStyle(source.styleId)

  return {
    id: source.id || `${createdDate.getTime()}-${index}`,
    createdAt,
    date: source.date || formatDiaryDate(createdDate),
    image: typeof source.image === 'string' ? source.image : '',
    thumbnail: typeof source.thumbnail === 'string' ? source.thumbnail : '',
    palette: normalizedPalette,
    dominantColorName,
    playlistName: source.playlistName || '未命名情绪歌单',
    bilingualCopy: source.bilingualCopy || '',
    emojis: Array.isArray(source.emojis) ? source.emojis.filter(Boolean).slice(0, 6) : [],
    styleId: style.id,
    styleName: source.styleName || style.name,
    templateType: source.templateType || 'classic',
    isDark: Boolean(source.isDark)
  }
}

function normalizeDiaryList(list) {
  if (!Array.isArray(list)) return []

  return list
    .map((item, index) => normalizeDiaryItem(item, index))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_DIARY_ITEMS)
}

function getDominantMood(items) {
  if (!items.length) {
    return {
      colorName: '待捕捉',
      color: '#E9F1F6',
      copy: '把今天的一束光存下来，手账会慢慢长出你的色谱。',
      count: 0
    }
  }

  const counts = new Map()
  items.forEach(item => {
    const colorName = item.dominantColorName || getChineseColorName(item.palette?.[0])
    const color = item.palette?.[0] || '#E9F1F6'
    const current = counts.get(colorName) || { colorName, color, count: 0 }
    counts.set(colorName, { ...current, count: current.count + 1 })
  })

  const dominant = [...counts.values()].sort((a, b) => b.count - a.count)[0]
  return {
    ...dominant,
    copy: getVibeCopy(dominant.colorName)
  }
}

function calculateStreak(items) {
  if (!items.length) return 0

  const dateKeys = new Set(items.map(item => getLocalDateKey(new Date(item.createdAt))))
  const newestDate = startOfDay(new Date(items[0].createdAt))
  let cursor = newestDate
  let streak = 0

  while (dateKeys.has(getLocalDateKey(cursor))) {
    streak += 1
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

const monthlyItems = computed(() => {
  const now = new Date()
  return diaryList.value.filter(item => isSameMonth(new Date(item.createdAt), now))
})

const weeklyItems = computed(() => {
  const now = new Date()
  const weekStart = getWeekStart(now)
  return diaryList.value.filter(item => new Date(item.createdAt) >= weekStart)
})

const vibeReport = computed(() => {
  const recentItem = diaryList.value[0]
  if (!recentItem) return getDominantMood([])

  return {
    colorName: recentItem.dominantColorName || getChineseColorName(recentItem.palette?.[0]),
    color: recentItem.palette?.[0] || '#E9F1F6',
    copy: getVibeCopy(recentItem.dominantColorName || getChineseColorName(recentItem.palette?.[0])),
    count: diaryList.value.length
  }
})

const diarySummary = computed(() => ({
  streak: calculateStreak(diaryList.value),
  monthlyCount: monthlyItems.value.length,
  monthLabel: new Intl.DateTimeFormat('zh-CN', { month: 'long' }).format(new Date())
}))

const calendarDays = computed(() => monthlyItems.value.map(item => ({
  dateKey: getLocalDateKey(new Date(item.createdAt)),
  color: item.palette?.[0] || '#E9F1F6'
})).reverse())

const weekReport = computed(() => {
  if (!weeklyItems.value.length) {
    return {
      colorName: '待记录',
      color: '#E9F1F6',
      copy: diaryList.value.length
        ? '本周还没留下颜色，最近一次心情会先替你占一个座。'
        : '本周还在留白，等一道颜色落在这里。',
      count: 0
    }
  }

  return getDominantMood(weeklyItems.value)
})

async function openDiary() {
  vibrate(10)
  const storedList = await VibeStorage.get('vibe_diary') 
  diaryList.value = normalizeDiaryList(storedList)
  status.value = 'diary'
}

function createDiaryThumbnail(base64Image, maxWidth = 360) {
  return new Promise(resolve => {
    if (!base64Image) {
      resolve('')
      return
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width)
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'low'
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/webp', 0.5))
    }
    img.onerror = () => resolve(base64Image)
    img.src = base64Image
  })
}

async function addToDiary() {
  let currentList = normalizeDiaryList(await VibeStorage.get('vibe_diary'))
  const createdDate = new Date()
  const style = selectedCopyStyle.value

  const newItem = {
    id: createdDate.getTime(),
    createdAt: createdDate.toISOString(),
    date: formatDiaryDate(createdDate),
    thumbnail: await createDiaryThumbnail(aiPayloadImage.value),
    palette: [...palette.value],
    dominantColorName: getChineseColorName(palette.value[0]),
    playlistName: playlistName.value,
    bilingualCopy: bilingualCopy.value,
    emojis: [...emojis.value],
    styleId: style.id,
    styleName: style.name,
    templateType: currentTemplate.value,
    isDark: isDarkMode.value 
  }
  
  currentList.unshift(newItem) 
  currentList = normalizeDiaryList(currentList)
  
  let isSaved = false
  while (!isSaved && currentList.length > 0) {
    try {
      await VibeStorage.set('vibe_diary', currentList)
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

function buildVibePrompt(hexColors, style) {
  return `你是一个拥有极高审美的情绪感知专家。请分析这张图片，并结合我刚刚提取出的图片主色调（${hexColors.join(', ')}），为其生成一组适合保存和分享的氛围文案。

本次文案风格：${style.promptName}
- playlistName 命名方向：${style.playlistGuide}
- bilingualCopy 语气：${style.copyGuide}
- emojis 选择：${style.emojiGuide}

硬性要求：
- 严格返回 JSON，不要 markdown，不要解释。
- 中文文案要短，适合发朋友圈或小红书。
- 英文文案要自然，不要机器翻译腔。
- emojis 只返回 2-4 个。

请严格按照以下 JSON 格式返回：
{
  "playlistName": "一个符合本次风格的短歌单名",
  "bilingualCopy": "一句中文短句 / A natural English line.",
  "emojis": ["🌧️", "☕", "🎧"]
}`
}

async function fetchVibeFromAI(base64Image, hexColors, style = selectedCopyStyle.value) {
  const prompt = buildVibePrompt(hexColors, style)

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
    
    return await fetchVibeFromAI(aiPayloadImage.value, extractedHex, selectedCopyStyle.value)
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
    const aiResult = await fetchVibeFromAI(aiPayloadImage.value, palette.value, selectedCopyStyle.value) 
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
    await addToDiary() 
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

        <div class="mb-2 w-full max-w-[19rem]">
          <p class="mb-2 text-[0.55rem] uppercase tracking-[0.24em] text-gray-400/80">文案风格</p>
          <div class="flex flex-wrap justify-center gap-1.5">
            <button
              v-for="style in COPY_STYLES"
              :key="style.id"
              type="button"
              class="rounded-full border px-3 py-1 text-[0.62rem] tracking-[0.08em] transition-all active:scale-95"
              :class="selectedStyleId === style.id ? 'border-gray-900/10 bg-gray-900/85 text-white shadow-sm' : 'border-white/70 bg-white/35 text-gray-500 backdrop-blur-xl hover:bg-white/60 hover:text-gray-800'"
              @click="selectCopyStyle(style.id)"
            >
              {{ style.name }}
            </button>
          </div>
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

        <div v-if="!isCardReadonly" class="mt-4 flex w-full flex-wrap justify-center gap-1.5 px-2">
          <button
            v-for="style in COPY_STYLES"
            :key="`result-style-${style.id}`"
            type="button"
            class="rounded-full border px-3 py-1 text-[0.6rem] tracking-[0.08em] transition-all active:scale-95"
            :class="selectedStyleId === style.id
              ? (isDarkMode ? 'border-white/20 bg-white/90 text-gray-900 shadow-sm' : 'border-gray-900/10 bg-gray-900/85 text-white shadow-sm')
              : (isDarkMode ? 'border-white/10 bg-white/10 text-gray-400 hover:bg-white/15 hover:text-gray-200' : 'border-white/70 bg-white/35 text-gray-500 backdrop-blur-xl hover:bg-white/60 hover:text-gray-800')"
            @click="selectCopyStyle(style.id)"
          >
            {{ style.name }}
          </button>
        </div>

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
      
      <VibeDiary
        v-else-if="status === 'diary'"
        :diaryList="diaryList"
        :diarySummary="diarySummary"
        :vibeReport="vibeReport"
        :calendarDays="calendarDays"
        :weekReport="weekReport"
        :isDarkMode="isDarkMode"
        @close="status = 'idle'"
      />
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
