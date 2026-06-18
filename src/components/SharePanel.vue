<script setup>
defineProps({
  presets: { type: Array, default: () => [] },
  selectedRatio: { type: String, default: 'feed' },
  showWatermark: Boolean,
  isDarkMode: Boolean,
  isSaving: Boolean,
  copyStatus: String
})

const emit = defineEmits(['set-ratio', 'toggle-watermark', 'save', 'back', 'copy'])
</script>

<template>
  <div class="mt-5 w-full rounded-3xl border p-4 shadow-sm backdrop-blur-xl" :class="isDarkMode ? 'border-white/10 bg-gray-950/45' : 'border-white/70 bg-white/60'">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <p class="text-[0.58rem] font-mono uppercase tracking-[0.28em] opacity-45">Share Format</p>
        <h3 class="mt-1 font-serif text-base tracking-wide">保存样式</h3>
      </div>
      <button
        type="button"
        class="rounded-full border px-3 py-1.5 text-[0.62rem] tracking-[0.18em] transition active:scale-95"
        :class="isDarkMode ? 'border-white/10 bg-white/5 text-gray-300' : 'border-gray-900/10 bg-white text-gray-500'"
        @click="emit('copy')"
      >
        {{ copyStatus || '复制文案' }}
      </button>
    </div>

    <div class="grid grid-cols-4 gap-2">
      <button
        v-for="preset in presets"
        :key="preset.key"
        type="button"
        class="h-12 rounded-2xl border text-[0.68rem] tracking-[0.08em] transition active:scale-95"
        :class="selectedRatio === preset.key
          ? (isDarkMode ? 'border-white bg-white text-gray-900' : 'border-gray-900 bg-gray-900 text-white')
          : (isDarkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-900/10 bg-white/60 text-gray-500')"
        @click="emit('set-ratio', preset.key)"
      >
        {{ preset.label }}
      </button>
    </div>

    <button
      type="button"
      class="mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]"
      :class="isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-900/10 bg-white/60'"
      @click="emit('toggle-watermark')"
    >
      <span>
        <span class="block text-sm">添加导出签名</span>
        <span class="mt-1 block text-[0.62rem] tracking-[0.12em] opacity-45">默认关闭，只出现在日期信息旁</span>
      </span>
      <span
        class="flex h-6 w-11 items-center rounded-full p-0.5 transition"
        :class="showWatermark ? 'bg-gray-900' : (isDarkMode ? 'bg-white/15' : 'bg-gray-300')"
      >
        <span class="h-5 w-5 rounded-full bg-white shadow-sm transition" :class="showWatermark ? 'translate-x-5' : 'translate-x-0'"></span>
      </span>
    </button>

    <div class="mt-4 flex w-full gap-3">
      <button
        type="button"
        class="h-14 flex-1 rounded-full border text-sm tracking-widest shadow-md transition active:scale-95"
        :class="isDarkMode ? 'border-transparent bg-gray-100 text-gray-900 hover:bg-white' : 'border-transparent bg-gray-900 text-white hover:bg-gray-800'"
        @click="emit('save')"
      >
        {{ isSaving ? 'SAVING...' : '保存卡片' }}
      </button>

      <button
        type="button"
        class="h-14 w-24 flex-shrink-0 rounded-full border text-sm tracking-widest shadow-sm transition active:scale-95"
        :class="isDarkMode ? 'border-white/20 bg-gray-900/50 text-gray-300 hover:bg-gray-800' : 'border-gray-900/10 bg-white/70 text-gray-600 hover:bg-white'"
        @click="emit('back')"
      >
        上一步
      </button>
    </div>
  </div>
</template>
