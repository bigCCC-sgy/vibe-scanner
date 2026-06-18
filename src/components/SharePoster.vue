<script setup>
import { computed, ref } from 'vue'
import { getChineseColorName } from '../utils/color'

const props = defineProps({
  templateType: { type: String, default: 'classic' },
  image: String,
  palette: { type: Array, default: () => [] },
  playlistName: String,
  bilingualCopy: String,
  emojis: { type: Array, default: () => [] },
  isDarkMode: Boolean,
  shareRatio: { type: String, default: 'feed' },
  showWatermark: Boolean,
  dateLabel: String
})

const posterElement = ref(null)
defineExpose({ posterElement })

const formattedCopy = computed(() => {
  const rawText = props.bilingualCopy || ''
  const parts = rawText.split('/')
  return {
    cn: parts[0] ? parts[0].trim() : rawText,
    en: parts[1] ? parts[1].trim() : ''
  }
})

const dominantColor = computed(() => props.palette[0] || '#E5E7EB')
const dominantName = computed(() => getChineseColorName(dominantColor.value))

const ratioClass = computed(() => {
  if (props.shareRatio === 'redbook') return 'aspect-[4/5]'
  if (props.shareRatio === 'square') return 'aspect-square'
  if (props.shareRatio === 'wallpaper') return 'aspect-[9/16]'
  return 'aspect-[3/4]'
})

const isMagazine = computed(() => props.templateType === 'magazine')
const isPolaroid = computed(() => props.templateType === 'polaroid')
const isWallpaper = computed(() => props.shareRatio === 'wallpaper')

const frameClass = computed(() => {
  if (isMagazine.value) return 'bg-gray-950 text-white'
  if (isPolaroid.value) return 'bg-[#FCFAF8] text-gray-900'
  return props.isDarkMode ? 'bg-[#151517] text-gray-100' : 'bg-[#F8FAFC] text-gray-900'
})
</script>

<template>
  <article
    ref="posterElement"
    class="relative w-full overflow-hidden rounded-[2rem] shadow-[0_24px_70px_rgba(15,23,42,0.2)]"
    :class="[ratioClass, frameClass]"
  >
    <template v-if="isMagazine">
      <img :src="image" crossorigin="anonymous" class="absolute inset-0 h-full w-full object-cover" alt="" />
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5"></div>
      <div class="absolute inset-x-6 bottom-7">
        <div class="mb-5 flex h-2 overflow-hidden rounded-full">
          <span
            v-for="(color, index) in palette"
            :key="`${color}-${index}`"
            class="flex-1"
            :style="{ backgroundColor: color }"
          ></span>
        </div>
        <p class="mb-3 text-[0.58rem] uppercase tracking-[0.32em] text-white/55">
          {{ dateLabel }} / {{ dominantName }}<span v-if="showWatermark"> / VibeCard</span>
        </p>
        <h2 class="font-serif text-3xl leading-tight tracking-wide text-white" :class="isWallpaper ? 'text-4xl' : ''">{{ playlistName }}</h2>
        <p class="mt-4 text-sm leading-6 text-white/85">{{ formattedCopy.cn }}</p>
        <p v-if="formattedCopy.en" class="mt-1 text-[0.7rem] leading-5 text-white/50">{{ formattedCopy.en }}</p>
        <div class="mt-5 flex gap-3 text-xl opacity-90">
          <span v-for="(emoji, index) in emojis" :key="`${emoji}-${index}`">{{ emoji }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex h-full flex-col p-5" :class="isWallpaper ? 'p-6' : ''">
        <div
          class="relative overflow-hidden shadow-inner"
          :class="[
            isPolaroid ? 'rounded-lg border-[10px] border-white bg-white' : 'rounded-[1.5rem]',
            isWallpaper ? 'h-[58%]' : 'h-[54%]'
          ]"
        >
          <img :src="image" crossorigin="anonymous" class="h-full w-full object-cover" alt="" />
          <div v-if="isPolaroid" class="absolute inset-0 bg-amber-50/10 mix-blend-multiply"></div>
        </div>

        <div class="mt-5 flex h-3 overflow-hidden rounded-full shadow-inner">
          <span
            v-for="(color, index) in palette"
            :key="`${color}-${index}`"
            class="flex-1"
            :style="{ backgroundColor: color }"
          ></span>
        </div>

        <div class="mt-4 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.26em] opacity-45">
          <span>{{ dateLabel }}</span>
          <span>{{ showWatermark ? `${dominantName} / VibeCard` : dominantName }}</span>
        </div>

        <div class="flex flex-1 flex-col justify-center text-center">
          <h2 class="font-serif leading-tight tracking-wide" :class="isWallpaper ? 'text-3xl' : 'text-2xl'">{{ playlistName }}</h2>
          <p class="mx-auto mt-4 max-w-[17rem] text-sm leading-6 opacity-75">{{ formattedCopy.cn }}</p>
          <p v-if="formattedCopy.en" class="mx-auto mt-1 max-w-[17rem] text-[0.68rem] leading-5 opacity-45">{{ formattedCopy.en }}</p>
          <div class="mt-5 flex justify-center gap-3 text-xl opacity-80">
            <span v-for="(emoji, index) in emojis" :key="`${emoji}-${index}`">{{ emoji }}</span>
          </div>
        </div>
      </div>
    </template>

  </article>
</template>
