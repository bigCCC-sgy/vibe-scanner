<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toBlob } from 'html-to-image'
import { extractColors } from 'extract-colors'
import { getChineseColorName, getVibeCopy } from './utils/color'
import { VibeStorage } from './utils/storage'
import DailySummary from './components/DailySummary.vue'
import SharePanel from './components/SharePanel.vue'
import SharePoster from './components/SharePoster.vue'
import VibeCard from './components/VibeCard.vue'
import VibeDiary from './components/VibeDiary.vue'

const DIARY_KEY = 'vibe_diary'
const SHARE_SETTINGS_KEY = 'vibe_share_settings'
const MAX_DIARY_ITEMS = 40

const SHARE_PRESETS = [
  { key: 'feed', label: '朋友圈', ratio: '3:4' },
  { key: 'redbook', label: '小红书', ratio: '4:5' },
  { key: 'square', label: '方图', ratio: '1:1' },
  { key: 'wallpaper', label: '壁纸', ratio: '9:16' }
]

const cameraInput = ref(null)
const galleryInput = ref(null)
const sharePosterRef = ref(null)

const currentTemplate = ref('classic')
const status = ref('idle')
const diaryList = ref([])
const displayImageUrl = ref('')
const aiPayloadImage = ref('')
const isSaving = ref(false)
const isRegenerating = ref(false)
const themeOverride = ref(null)
const currentScanTextIndex = ref(0)
const sourceType = ref('gallery')
const currentDiaryEntryId = ref(null)
const copyStatus = ref('')
const shareSettings = ref({ ratio: 'feed', showWatermark: false })

const palette = ref(['#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'])
const playlistName = ref('正在感知氛围...')
const bilingualCopy = ref('解析光影频率 / Decoding light frequencies.')
const emojis = ref(['✨', '⏳', '🌫️'])

const scanTexts = ['正在提取光影...', '感受色彩温度...', '生成情绪波形...']
let scanInterval = null
let copyStatusTimer = null

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function toDate(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function getDayKey(value = new Date()) {
  const date = toDate(value)
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

function addDays(value, amount) {
  const date = toDate(value)
  date.setDate(date.getDate() + amount)
  return date
}

function getDateTimeLabel(value = new Date()) {
  return toDate(value).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getDateLabel(value = new Date()) {
  return toDate(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getMonthLabel(value = new Date()) {
  return toDate(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
}

function vibrate(pattern = 15) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch (e) {}
  }
}

function getLuminance(hex) {
  let r = parseInt(hex.slice(1, 3), 16) || 0
  let g = parseInt(hex.slice(3, 5), 16) || 0
  let b = parseInt(hex.slice(5, 7), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function getReadableTextColor(hex) {
  return getLuminance(hex) < 0.52 ? '#F9FAFB' : '#111827'
}

function normalizeDiaryItem(item = {}) {
  const createdAt = item.createdAt || new Date(Number(item.id) || Date.now()).toISOString()
  const colors = Array.isArray(item.palette) && item.palette.length ? item.palette : ['#E5E7EB']
  const dominantColor = item.dominantColor || colors[0]

  return {
    version: 2,
    id: item.id || Date.now(),
    createdAt,
    dayKey: item.dayKey || getDayKey(createdAt),
    date: item.date || getDateTimeLabel(createdAt),
    image: item.image || '',
    thumbnail: item.thumbnail || item.image || '',
    palette: colors,
    dominantColor,
    dominantColorName: item.dominantColorName || getChineseColorName(dominantColor),
    playlistName: item.playlistName || '未知的情绪波段',
    bilingualCopy: item.bilingualCopy || '无法解析的氛围 / Unresolved vibe.',
    emojis: Array.isArray(item.emojis) ? item.emojis : ['✨', '🤍', '🌫️'],
    templateType: item.templateType || 'classic',
    aspectRatio: item.aspectRatio || 'feed',
    showWatermark: Boolean(item.showWatermark),
    shareCount: item.shareCount || 0,
    isDark: Boolean(item.isDark),
    source: item.source || 'gallery'
  }
}

async function loadDiary() {
  const storedList = await VibeStorage.get(DIARY_KEY)
  diaryList.value = Array.isArray(storedList)
    ? storedList.map(normalizeDiaryItem).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : []
}

async function loadShareSettings() {
  const storedSettings = await VibeStorage.get(SHARE_SETTINGS_KEY)
  const hasValidRatio = SHARE_PRESETS.some(preset => preset.key === storedSettings?.ratio)

  shareSettings.value = {
    ratio: hasValidRatio ? storedSettings.ratio : 'feed',
    showWatermark: Boolean(storedSettings?.showWatermark)
  }
}

async function persistShareSettings() {
  try {
    await VibeStorage.set(SHARE_SETTINGS_KEY, shareSettings.value)
  } catch (e) {}
}

const selectedSharePreset = computed(() => {
  return SHARE_PRESETS.find(preset => preset.key === shareSettings.value.ratio) || SHARE_PRESETS[0]
})

const todayKey = computed(() => getDayKey())

const todayEntry = computed(() => {
  return diaryList.value.find(item => item.dayKey === todayKey.value) || null
})

const vibeReport = computed(() => {
  if (diaryList.value.length === 0) return null

  const colorCounts = {}
  diaryList.value.forEach(item => {
    item.palette.forEach(hex => {
      const name = getChineseColorName(hex)
      colorCounts[name] = (colorCounts[name] || 0) + 1
    })
  })

  let dominantColor = ''
  let maxCount = 0
  for (const [name, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count
      dominantColor = name
    }
  }

  return {
    colorName: dominantColor,
    copy: getVibeCopy(dominantColor),
    count: diaryList.value.length
  }
})

const diarySummary = computed(() => {
  const dayKeys = new Set(diaryList.value.map(item => item.dayKey))
  const now = new Date()
  let cursor = new Date(now)

  if (!dayKeys.has(getDayKey(cursor))) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0
  while (dayKeys.has(getDayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  const monthPrefix = todayKey.value.slice(0, 7)
  const monthlyCount = diaryList.value.filter(item => item.dayKey?.startsWith(monthPrefix)).length

  return {
    streak,
    monthlyCount,
    totalCount: diaryList.value.length,
    monthLabel: getMonthLabel(now)
  }
})

const calendarDays = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const recordByDay = new Map()

  diaryList.value.forEach(item => {
    if (!recordByDay.has(item.dayKey)) {
      recordByDay.set(item.dayKey, item)
    }
  })

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const key = `${year}-${padNumber(month + 1)}-${padNumber(day)}`
    const item = recordByDay.get(key)
    const color = item?.dominantColor || item?.palette?.[0] || ''

    return {
      day,
      key,
      color,
      textColor: color ? getReadableTextColor(color) : undefined,
      isToday: key === todayKey.value
    }
  })
})

const weekReport = computed(() => {
  const start = addDays(new Date(), -6)
  start.setHours(0, 0, 0, 0)
  const records = diaryList.value.filter(item => new Date(item.createdAt) >= start)

  if (records.length < 3) return null

  const colorCounts = {}
  const paletteSet = []

  records.forEach(item => {
    const colorName = item.dominantColorName || getChineseColorName(item.dominantColor || item.palette?.[0])
    colorCounts[colorName] = (colorCounts[colorName] || 0) + 1
    item.palette.forEach(color => {
      if (!paletteSet.includes(color) && paletteSet.length < 7) paletteSet.push(color)
    })
  })

  let colorName = ''
  let maxCount = 0
  for (const [name, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      colorName = name
      maxCount = count
    }
  }

  return {
    colorName,
    palette: paletteSet.length ? paletteSet : ['#E5E7EB'],
    copy: getVibeCopy(colorName),
    count: records.length
  }
})

const isDarkMode = computed(() => {
  if (themeOverride.value !== null) return themeOverride.value === 'dark'
  if (!palette.value.length) return false
  const totalLum = palette.value.reduce((acc, color) => acc + getLuminance(color), 0)
  const avgLum = totalLum / palette.value.length
  return avgLum < 0.5
})

const isCardReadonly = computed(() => isSaving.value || status.value === 'preview')

function toggleTheme() {
  vibrate(10)
  document.activeElement?.blur()
  themeOverride.value = isDarkMode.value ? 'light' : 'dark'
}

function setShareRatio(ratio) {
  vibrate(10)
  shareSettings.value = { ...shareSettings.value, ratio }
  persistShareSettings()
}

function toggleWatermark() {
  vibrate(10)
  shareSettings.value = {
    ...shareSettings.value,
    showWatermark: !shareSettings.value.showWatermark
  }
  persistShareSettings()
}

function createShareText() {
  const colorName = getChineseColorName(palette.value[0])
  return `${playlistName.value}\n${bilingualCopy.value}\n今日氛围色：${colorName}`
}

async function copyShareText() {
  try {
    await navigator.clipboard.writeText(createShareText())
    copyStatus.value = '已复制'
  } catch (e) {
    copyStatus.value = '复制失败'
  } finally {
    if (copyStatusTimer) clearTimeout(copyStatusTimer)
    copyStatusTimer = window.setTimeout(() => {
      copyStatus.value = ''
    }, 1600)
  }
}

function compressImage(file, maxWidth = 520) {
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
      resolve(canvas.toDataURL('image/webp', 0.55))
    }
    img.onerror = e => reject(e)
  })
}

async function fetchVibeFromAI(base64Image, hexColors) {
  const prompt = `你是一个拥有极高审美的情绪感知专家。请分析这张图片，并结合我刚刚提取出的图片主色调（${hexColors.join(', ')}），为其生成具有杂志感和氛围感的文案。请以整张图片的主体、场景、光影和情绪为主，色彩只作为辅助参考。请严格按照以下 JSON 格式返回，不要输出 markdown 标记：
{
  "playlistName": "一个带有诗意和情绪的独立音乐歌单名，例如：适合在雨天发呆的 Lo-Fi",
  "bilingualCopy": "一句极其克制、高级的中英双语朋友圈文案，例如：在城市的缝隙里呼吸 / Breathing in the cracks of the city.",
  "emojis": ["🌧️", "☕", "🎧"]
}`

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 90000)
  const startedAt = performance.now()

  try {
    const response = await fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.7-plus',
        response_format: { type: 'json_object' },
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64Image } }
          ]
        }]
      }),
      signal: controller.signal
    })

    const data = await response.json()
    const elapsedMs = Math.round(performance.now() - startedAt)

    if (!response.ok) {
      console.error('AI 上游返回错误:', {
        status: response.status,
        elapsedMs,
        code: data?.error?.code,
        message: data?.error?.message
      })
      return null
    }

    if (data.choices && data.choices[0]) {
      let rawContent = data.choices[0].message.content
      rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim()
      console.info('AI 图片解析完成:', { elapsedMs })
      return JSON.parse(rawContent)
    }
    console.error('AI 返回缺少 choices:', { elapsedMs, data })
  } catch (e) {
    const elapsedMs = Math.round(performance.now() - startedAt)
    console.error('AI 接口调用崩溃:', {
      elapsedMs,
      name: e.name,
      message: e.name === 'AbortError' ? 'AI 解析超过 90 秒，已自动停止' : e.message
    })
  } finally {
    window.clearTimeout(timeout)
  }

  return null
}

function openCamera() {
  sourceType.value = 'camera'
  vibrate(20)
  cameraInput.value?.click()
}

function openGallery() {
  sourceType.value = 'gallery'
  vibrate(20)
  galleryInput.value?.click()
}

async function handleUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  currentDiaryEntryId.value = null
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
  } catch (e) {
    alert('读取图片失败！')
    status.value = 'idle'
    return
  }

  if (scanInterval) clearInterval(scanInterval)
  scanInterval = window.setInterval(() => {
    currentScanTextIndex.value = (currentScanTextIndex.value + 1) % scanTexts.length
  }, 800)

  const waitAnimation = new Promise(resolve => setTimeout(resolve, 3000))

  const dataPipeline = (async () => {
    let extractedHex = []
    try {
      const colors = await extractColors(aiPayloadImage.value)
      extractedHex = colors.slice(0, 5).map(c => c.hex.toUpperCase())
      while (extractedHex.length < 5 && extractedHex.length > 0) {
        extractedHex.push(extractedHex[extractedHex.length - 1])
      }
      if (extractedHex.length > 0) palette.value = extractedHex
    } catch (e) {}

    return await fetchVibeFromAI(aiPayloadImage.value, extractedHex)
  })()

  try {
    const [, aiResult] = await Promise.all([waitAnimation, dataPipeline])
    if (aiResult) {
      playlistName.value = aiResult.playlistName || '未知的情绪波段'
      bilingualCopy.value = aiResult.bilingualCopy || '无法解析的氛围 / Unresolved vibe.'
      emojis.value = aiResult.emojis || ['✨', '🤍', '🌫️']
      vibrate([20, 50])
    } else {
      playlistName.value = '未知的情绪波段'
      bilingualCopy.value = '无法解析的氛围 / Unresolved vibe.'
      emojis.value = ['✨', '🤍', '🌫️']
    }
  } catch (e) {
  } finally {
    clearInterval(scanInterval)
    scanInterval = null
    status.value = 'result'
  }
}

async function regenerateVibe() {
  if (isRegenerating.value || !aiPayloadImage.value) return
  vibrate(15)
  isRegenerating.value = true

  try {
    const aiResult = await fetchVibeFromAI(aiPayloadImage.value, palette.value)
    if (!aiResult) {
      return
    }
    playlistName.value = aiResult.playlistName || playlistName.value
    bilingualCopy.value = aiResult.bilingualCopy || bilingualCopy.value
    emojis.value = aiResult.emojis || emojis.value
    vibrate([15, 30])
  } finally {
    isRegenerating.value = false
  }
}

function goToPreview() {
  vibrate(10)
  document.activeElement?.blur()
  status.value = 'preview'
}

function goBackToEdit() {
  vibrate(10)
  status.value = 'result'
}

async function saveDiaryItem() {
  let currentList = await VibeStorage.get(DIARY_KEY) || []
  currentList = Array.isArray(currentList) ? currentList.map(normalizeDiaryItem) : []

  const now = new Date()
  const currentId = currentDiaryEntryId.value || Date.now()
  const existingIndex = currentList.findIndex(item => item.id === currentId)
  const previousItem = existingIndex >= 0 ? currentList[existingIndex] : null

  const item = normalizeDiaryItem({
    ...previousItem,
    id: currentId,
    createdAt: previousItem?.createdAt || now.toISOString(),
    dayKey: previousItem?.dayKey || getDayKey(now),
    date: previousItem?.date || getDateTimeLabel(now),
    image: aiPayloadImage.value,
    thumbnail: aiPayloadImage.value,
    palette: [...palette.value],
    dominantColor: palette.value[0],
    dominantColorName: getChineseColorName(palette.value[0]),
    playlistName: playlistName.value,
    bilingualCopy: bilingualCopy.value,
    emojis: [...emojis.value],
    templateType: currentTemplate.value,
    aspectRatio: shareSettings.value.ratio,
    showWatermark: shareSettings.value.showWatermark,
    shareCount: (previousItem?.shareCount || 0) + 1,
    isDark: isDarkMode.value,
    source: sourceType.value
  })

  if (existingIndex >= 0) {
    currentList.splice(existingIndex, 1, item)
  } else {
    currentList.unshift(item)
  }

  currentList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  if (currentList.length > MAX_DIARY_ITEMS) currentList = currentList.slice(0, MAX_DIARY_ITEMS)

  let isSaved = false
  while (!isSaved && currentList.length > 0) {
    try {
      await VibeStorage.set(DIARY_KEY, currentList)
      diaryList.value = currentList
      currentDiaryEntryId.value = item.id
      isSaved = true
    } catch (e) {
      console.warn('存储空间超限，自动丢弃一条最旧的记录...')
      currentList.pop()
    }
  }
}

async function saveCard() {
  if (!sharePosterRef.value?.posterElement || isSaving.value) return
  vibrate(15)
  isSaving.value = true
  document.activeElement?.blur()

  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    const targetDOM = sharePosterRef.value.posterElement
    const blob = await toBlob(targetDOM, {
      pixelRatio: 3,
      backgroundColor: isDarkMode.value || currentTemplate.value === 'magazine' ? '#111827' : '#F9FAFB',
      style: { transform: 'scale(1)' }
    })

    if (!blob) throw new Error('DOM 渲染 Blob 失败')

    await saveDiaryItem()
    vibrate([30, 50])

    const fileName = `VibeCard_${selectedSharePreset.value.key}_${Date.now()}.png`
    const file = new File([blob], fileName, { type: 'image/png' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: '氛围感取色器',
          text: createShareText(),
          files: [file]
        })
      } catch (e) {
        if (e.name !== 'AbortError') throw e
      }
    } else {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  } catch (err) {
    alert(`保存失败: ${err.message || err.name}`)
  } finally {
    isSaving.value = false
  }
}

async function openDiary() {
  vibrate(10)
  await loadDiary()
  status.value = 'diary'
}

function reset() {
  vibrate(10)
  themeOverride.value = null
  status.value = 'idle'
  currentDiaryEntryId.value = null

  if (displayImageUrl.value) {
    URL.revokeObjectURL(displayImageUrl.value)
    displayImageUrl.value = ''
  }
  aiPayloadImage.value = ''

  if (cameraInput.value) cameraInput.value.value = ''
  if (galleryInput.value) galleryInput.value.value = ''
}

onMounted(() => {
  loadDiary()
  loadShareSettings()
})

onBeforeUnmount(() => {
  if (scanInterval) clearInterval(scanInterval)
  if (copyStatusTimer) clearTimeout(copyStatusTimer)
})
</script>

<template>
  <div class="fixed inset-0 -z-10 overflow-hidden bg-[#F9FAFB] transition-colors duration-1000">
    <div v-if="status === 'idle'" class="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-1000">
      <div class="absolute top-[-10%] left-[-10%] h-[30rem] w-[30rem] animate-blob rounded-full bg-cyan-200/40 mix-blend-multiply blur-[100px]"></div>
      <div class="absolute top-[20%] right-[-10%] h-[25rem] w-[25rem] animate-blob rounded-full bg-pink-200/40 mix-blend-multiply blur-[100px]" style="animation-delay: 2s;"></div>
      <div class="absolute bottom-[-10%] left-[20%] h-[35rem] w-[35rem] animate-blob rounded-full bg-purple-200/30 mix-blend-multiply blur-[100px]" style="animation-delay: 4s;"></div>
    </div>

    <div v-if="status !== 'idle' && displayImageUrl" class="absolute inset-0 opacity-100 transition-opacity duration-1000">
      <img :src="displayImageUrl" class="absolute inset-0 h-full w-full scale-110 object-cover opacity-30" alt="bg-blur" />
      <div class="absolute inset-0 bg-white/50 backdrop-blur-3xl" :class="isDarkMode ? 'bg-black/70' : 'bg-white/50'"></div>
    </div>
  </div>

  <main class="relative z-10 flex min-h-[100dvh] flex-col items-center overflow-x-hidden px-6 py-10" :class="isDarkMode ? 'text-gray-100' : 'text-gray-800'">
    <input ref="cameraInput" class="sr-only" type="file" accept="image/*" capture="environment" @change="handleUpload" />
    <input ref="galleryInput" class="sr-only" type="file" accept="image/*" @change="handleUpload" />

    <section class="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
      <div v-if="status === 'idle'" class="relative z-10 flex w-full flex-col items-center text-center animate-fade-in">
        <div class="mb-8 flex flex-col items-center">
          <p class="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.4em] text-gray-400/70">Capture The Vibe</p>
          <h1 class="mb-4 font-serif text-[2.75rem] leading-none tracking-wide text-gray-900">氛围感取色器</h1>
          <p class="text-[0.75rem] font-light tracking-[0.2em] text-gray-400">万物皆有氛围</p>
        </div>

        <DailySummary
          :todayEntry="todayEntry"
          :streak="diarySummary.streak"
          :monthlyCount="diarySummary.monthlyCount"
          :vibeReport="vibeReport"
          @capture="openCamera"
          @gallery="openGallery"
          @diary="openDiary"
        />
      </div>

      <div v-else-if="status === 'scanning'" class="flex w-full flex-col items-center gap-10">
        <div class="relative h-[22rem] w-64 overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
          <img :src="displayImageUrl" class="h-full w-full object-cover" alt="" />
          <div class="absolute inset-0 bg-black/10"></div>
          <div class="scan-line absolute left-0 right-0 top-0 h-32"></div>
        </div>
        <div class="flex h-8 items-center justify-center">
          <transition name="fade" mode="out-in">
            <p :key="currentScanTextIndex" class="font-serif text-lg tracking-widest text-gray-800/80" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
              {{ scanTexts[currentScanTextIndex] }}
            </p>
          </transition>
        </div>
      </div>

      <div v-else-if="status === 'result'" class="flex w-full flex-col items-center animate-fade-in">
        <VibeCard
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

        <div class="mt-6 flex gap-2 rounded-full p-1.5 transition-colors" :class="isDarkMode ? 'bg-white/10' : 'bg-black/5'">
          <button @click="currentTemplate = 'classic'; vibrate(10)" class="rounded-full px-5 py-1.5 text-xs font-medium transition-all" :class="currentTemplate === 'classic' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">经典</button>
          <button @click="currentTemplate = 'polaroid'; vibrate(10)" class="rounded-full px-5 py-1.5 text-xs font-medium transition-all" :class="currentTemplate === 'polaroid' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">拍立得</button>
          <button @click="currentTemplate = 'magazine'; vibrate(10)" class="rounded-full px-5 py-1.5 text-xs font-medium transition-all" :class="currentTemplate === 'magazine' ? (isDarkMode ? 'bg-gray-100 text-gray-900 shadow-sm' : 'bg-white text-gray-900 shadow-sm') : 'text-gray-500 hover:text-gray-700'">杂志</button>
        </div>

        <p class="mt-4 animate-pulse text-center text-[0.55rem] tracking-[0.1em]" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
          ✨ 点击文案/色块修改，左上角切换明暗
        </p>

        <div class="mt-4 flex w-full gap-4 px-2">
          <button
            type="button"
            class="h-14 flex-1 rounded-full border text-sm tracking-widest shadow-md transition-all active:scale-95"
            :class="isDarkMode ? 'border-transparent bg-gray-100 text-gray-900 hover:bg-white' : 'border-transparent bg-gray-900 text-white hover:bg-gray-800'"
            @click="goToPreview"
          >
            下一步
          </button>

          <button
            type="button"
            class="h-14 w-24 flex-shrink-0 rounded-full border text-sm tracking-widest shadow-sm backdrop-blur-md transition-all active:scale-95"
            :class="isDarkMode ? 'border-white/20 bg-gray-900/50 text-gray-300 hover:bg-gray-800' : 'border-gray-900/10 bg-white/50 text-gray-600 hover:bg-white'"
            @click="reset"
          >
            重选
          </button>
        </div>
      </div>

      <div v-else-if="status === 'preview'" class="flex w-full flex-col items-center animate-fade-in">
        <div class="w-full" :class="shareSettings.ratio === 'wallpaper' ? 'max-w-[18rem]' : 'max-w-sm'">
          <SharePoster
            ref="sharePosterRef"
            :templateType="currentTemplate"
            :image="displayImageUrl"
            :palette="palette"
            :playlistName="playlistName"
            :bilingualCopy="bilingualCopy"
            :emojis="emojis"
            :isDarkMode="isDarkMode"
            :shareRatio="shareSettings.ratio"
            :showWatermark="shareSettings.showWatermark"
            :dateLabel="getDateLabel()"
          />
        </div>

        <p class="mt-4 text-center text-[0.55rem] tracking-[0.1em]" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
          预览模式：保存后的卡片效果如上所示
        </p>

        <SharePanel
          :presets="SHARE_PRESETS"
          :selectedRatio="shareSettings.ratio"
          :showWatermark="shareSettings.showWatermark"
          :isDarkMode="isDarkMode"
          :isSaving="isSaving"
          :copyStatus="copyStatus"
          @set-ratio="setShareRatio"
          @toggle-watermark="toggleWatermark"
          @save="saveCard"
          @back="goBackToEdit"
          @copy="copyShareText"
        />
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
