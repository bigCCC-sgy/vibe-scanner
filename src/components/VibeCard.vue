<script setup>
import { ref } from 'vue'
import { getChineseColorName } from '../utils/color'

const props = defineProps({
  templateType: { type: String, default: 'classic' }, 
  image: String,
  palette: Array,
  playlistName: String,
  bilingualCopy: String,
  emojis: Array,
  isDarkMode: Boolean,
  isCardReadonly: Boolean,
  isRegenerating: Boolean,
  status: String
})

const emit = defineEmits([
  'update:playlistName', 'update:bilingualCopy', 'update:emojis', 'update:palette', 
  'toggleTheme', 'regenerate'
])

const cardElement = ref(null)
defineExpose({ cardElement })

function vibrate(pattern = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch(e) {}
  }
}

function updateColor(index, newColor) {
  const newPalette = [...props.palette]
  newPalette[index] = newColor.toUpperCase()
  emit('update:palette', newPalette)
  vibrate(10)
}

function removeColor(index) {
  const newPalette = [...props.palette]
  newPalette.splice(index, 1)
  emit('update:palette', newPalette)
  vibrate(15)
}

function addColor() {
  const newPalette = [...props.palette]
  newPalette.push('#E5E7EB')
  emit('update:palette', newPalette)
  vibrate(15)
}

function updateEmoji(index, newEmoji) {
  const newEmojis = [...props.emojis]
  if (newEmoji) {
    newEmojis[index] = newEmoji
  } else {
    newEmojis.splice(index, 1)
  }
  emit('update:emojis', newEmojis)
  vibrate(10)
}

function addEmoji() {
  const newEmojis = [...props.emojis]
  newEmojis.push('✨')
  emit('update:emojis', newEmojis)
  vibrate(15)
}
</script>

<template>
  <article ref="cardElement" class="w-full transition-all duration-700 relative">
    
    <div v-if="templateType === 'classic'" 
         class="relative w-full rounded-[2.5rem] p-6 backdrop-blur-2xl transition-all duration-500"
         :class="isDarkMode 
           ? 'bg-[#1c1c1e]/80 border border-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/5' 
           : 'bg-white/60 border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04),0_24px_60px_-12px_rgb(0,0,0,0.12)] ring-1 ring-inset ring-white/60'">
      
      <button v-if="!isCardReadonly" @click="emit('toggleTheme')" class="absolute top-5 left-5 p-2 rounded-full transition-all active:scale-90" :class="[isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-400']">
        <svg v-if="isDarkMode" class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        <svg v-else class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      </button>
      <button v-if="!isCardReadonly" @click="emit('regenerate')" class="absolute top-5 right-5 p-2 rounded-full transition-all active:scale-90" :class="[isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-400']">
        <svg v-if="!isRegenerating" class="h-[1.1rem] w-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        <svg v-else class="h-[1.1rem] w-[1.1rem] animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
      </button>

      <div class="mb-5 flex justify-center">
         <span class="text-[0.6rem] tracking-widest uppercase font-mono" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">Vibe Card</span>
      </div>
      
      <img :src="image" crossorigin="anonymous" class="h-72 w-full rounded-[1.5rem] object-cover shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] ring-1 ring-black/5" />
      
      <div class="mt-6 flex h-10 w-full overflow-hidden rounded-xl shadow-inner border" :class="isDarkMode ? 'border-white/10' : 'border-black/5'">
        <div v-for="(color, index) in palette" :key="`block-${index}`" class="relative flex-1 transition-colors duration-300" :style="{ backgroundColor: color }">
          <input v-if="status === 'result'" type="color" :value="color" @input="updateColor(index, $event.target.value)" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </div>
        <button v-if="palette.length < 7 && !isCardReadonly" @click="addColor" class="flex w-8 items-center justify-center transition-colors active:scale-90" :class="isDarkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-black/5 text-gray-400 hover:bg-black/10'">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
      
      <div class="mt-2 flex w-full px-1 text-[0.65rem] font-serif" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
        <div v-for="(color, index) in palette" :key="`label-${index}`" class="flex-1 flex justify-center items-center">
          <span class="tracking-[0.15em] opacity-80">{{ getChineseColorName(color) }}</span>
          <button v-if="palette.length > 2 && !isCardReadonly" @click="removeColor(index)" class="ml-[2px] pb-[1px] text-[0.6rem] hover:text-red-400 transition-all font-sans">&times;</button>
        </div>
        <div v-if="palette.length < 7 && !isCardReadonly" class="w-8"></div>
      </div>

      <div class="px-2 pb-2 pt-8 text-center">
        <h2 class="font-serif text-[1.35rem] font-medium tracking-wide leading-relaxed outline-none rounded-lg px-2 py-1 transition-colors" :class="[isDarkMode ? 'text-gray-100' : 'text-gray-900', status === 'result' ? (isDarkMode ? 'focus:bg-white/10' : 'focus:bg-black/5') : '']" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:playlistName', $event.target.innerText); vibrate(10)" @keydown.enter.prevent="$event.target.blur()">{{ playlistName }}</h2>
        <p class="mx-auto mt-2 max-w-[16rem] text-xs leading-relaxed font-light outline-none rounded-lg px-2 py-1 transition-colors" :class="[isDarkMode ? 'text-gray-400' : 'text-gray-500', status === 'result' ? (isDarkMode ? 'focus:bg-white/10' : 'focus:bg-black/5') : '']" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:bilingualCopy', $event.target.innerText); vibrate(10)">{{ bilingualCopy }}</p>
        
        <div class="mt-6 flex justify-center items-center gap-4 text-xl opacity-80 filter grayscale-[20%]">
          <span 
            v-for="(emoji, index) in emojis" :key="`emoji-${index}`"
            class="outline-none rounded-lg px-1 py-0.5 transition-all min-w-[1.5rem] text-center"
            :class="status === 'result' ? (isDarkMode ? 'focus:bg-white/10 cursor-text' : 'focus:bg-black/5 cursor-text') : ''"
            :contenteditable="!isCardReadonly" spellcheck="false"
            @blur="updateEmoji(index, $event.target.innerText.trim())"
            @keydown.enter.prevent="$event.target.blur()"
          >{{ emoji }}</span>
          
          <button v-if="emojis.length < 6 && !isCardReadonly" @click="addEmoji" class="flex items-center justify-center text-gray-400 hover:scale-110 active:scale-90 transition-all">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="templateType === 'polaroid'" 
         class="w-full bg-[#FCFAF8] p-4 pb-16 relative rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.03),0_20px_50px_-12px_rgb(0,0,0,0.15)] border border-black/5 ring-1 ring-inset ring-white/50">
        
        <img :src="image" crossorigin="anonymous" class="w-full aspect-[4/5] object-cover filter contrast-[1.05] sepia-[.1] shadow-inner" />      
        
        <div class="mt-8 flex flex-col items-center px-4">
        <h2 class="font-sans text-xl text-gray-800 tracking-wider text-center outline-none" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:playlistName', $event.target.innerText)">{{ playlistName }}</h2>
        <p class="text-[0.65rem] text-gray-500 mt-3 text-center leading-relaxed outline-none" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:bilingualCopy', $event.target.innerText)">{{ bilingualCopy }}</p>
        
        <div class="flex gap-3 mt-8">
          <div v-for="c in palette" :key="c" :style="{backgroundColor: c}" class="w-5 h-5 rounded-full shadow-inner border border-black/10"></div>
        </div>
      </div>
    </div>

    <div v-else-if="templateType === 'magazine'" 
         class="relative w-full aspect-[3/4] rounded-[1.5rem] overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/20 border border-black/10">
      
      <img :src="image" crossorigin="anonymous" class="absolute inset-0 w-full h-full object-cover scale-105" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>
      
      <div class="absolute bottom-8 left-6 right-6">
        <div class="flex gap-1.5 mb-5 opacity-90">
          <div v-for="c in palette" :key="c" :style="{backgroundColor: c}" class="flex-1 h-1.5 rounded-full shadow-sm"></div>
        </div>
        
        <h2 class="font-serif text-3xl text-white tracking-widest uppercase mb-3 leading-tight outline-none" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:playlistName', $event.target.innerText)">{{ playlistName }}</h2>
        <p class="text-[0.7rem] text-gray-300 font-light outline-none" :contenteditable="!isCardReadonly" spellcheck="false" @blur="emit('update:bilingualCopy', $event.target.innerText)">{{ bilingualCopy }}</p>
      </div>
    </div>

  </article>
</template>