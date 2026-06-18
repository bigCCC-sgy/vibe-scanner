<script setup>
import { computed } from 'vue'

const props = defineProps({
  diaryList: { type: Array, default: () => [] },
  diarySummary: { type: Object, default: () => ({}) },
  vibeReport: Object,
  calendarDays: { type: Array, default: () => [] },
  weekReport: Object,
  isDarkMode: Boolean
})

const emit = defineEmits(['close'])

const monthPalette = computed(() => {
  const colors = props.calendarDays
    .filter(day => day.color)
    .map(day => day.color)

  return colors.length ? colors.slice(0, 12) : ['#E9F1F6', '#D8E3E7', '#BBCBC2', '#D6ECF0', '#F2F2F2']
})
</script>

<template>
  <div class="relative z-10 flex h-[85vh] w-full flex-col animate-fade-in">
    <div class="mb-5 flex items-center justify-between px-2">
      <div class="flex flex-col">
        <h2 class="font-serif text-2xl tracking-widest text-gray-900">情绪手账</h2>
        <span class="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-gray-400">Vibe Diary</span>
      </div>
      <button
        type="button"
        class="rounded-full bg-white/45 px-4 py-2 text-[0.7rem] tracking-widest text-gray-500 shadow-[inset_0_0_0_1px_rgba(17,24,39,0.06)] transition hover:text-gray-900 active:scale-95"
        @click="emit('close')"
      >
        返回
      </button>
    </div>

    <div class="flex-1 space-y-4 overflow-y-auto px-1 pb-10" style="scrollbar-width: none;">
      <section class="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/60 p-4 shadow-[0_14px_42px_rgba(15,23,42,0.07)] backdrop-blur-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[0.58rem] font-mono uppercase tracking-[0.28em] text-gray-400">Recent Tone</p>
            <h3 class="mt-2 font-serif text-xl tracking-wide text-gray-900">{{ vibeReport?.colorName || '寻色' }}</h3>
          </div>
          <div class="flex gap-5 text-right">
            <div>
              <div class="font-serif text-xl leading-none text-gray-900">{{ diarySummary.streak || 0 }}</div>
              <div class="mt-1 text-[0.56rem] tracking-[0.16em] text-gray-400">连续</div>
            </div>
            <div>
              <div class="font-serif text-xl leading-none text-gray-900">{{ diarySummary.monthlyCount || 0 }}</div>
              <div class="mt-1 text-[0.56rem] tracking-[0.16em] text-gray-400">本月</div>
            </div>
          </div>
        </div>

        <p v-if="vibeReport" class="mt-4 text-[0.78rem] leading-6 text-gray-500">
          {{ vibeReport.copy }}
        </p>

        <div class="mt-5">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[0.58rem] uppercase tracking-[0.22em] text-gray-400">Month Palette</span>
            <span class="text-[0.58rem] tracking-[0.16em] text-gray-400">{{ diarySummary.monthLabel }}</span>
          </div>
          <div class="flex h-8 overflow-hidden rounded-full border border-white/80 bg-white/50 shadow-inner">
            <span
              v-for="(color, index) in monthPalette"
              :key="`${color}-${index}`"
              class="flex-1"
              :style="{ backgroundColor: color }"
            ></span>
          </div>
        </div>
      </section>

      <section v-if="weekReport" class="rounded-[1.75rem] border border-white/70 bg-white/55 p-4 shadow-[0_14px_42px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
        <p class="text-[0.58rem] font-mono uppercase tracking-[0.28em] text-gray-400">Weekly Note</p>
        <h3 class="mt-2 font-serif text-lg tracking-wide text-gray-900">本周偏向 {{ weekReport.colorName }}</h3>
        <p class="mt-2 text-[0.78rem] leading-6 text-gray-500">{{ weekReport.copy }}</p>
      </section>

      <div v-if="!diaryList.length" class="mt-28 text-center text-xs font-light tracking-widest text-gray-400">
        暂无记录，去捕捉你的第一道光影吧。
      </div>

      <article
        v-for="item in diaryList"
        :key="item.id"
        class="flex gap-4 rounded-[1.75rem] border border-white/70 bg-white/[0.62] p-4 text-gray-800 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-2xl transition active:scale-[0.99]"
      >
        <img :src="item.thumbnail || item.image" class="h-24 w-20 rounded-2xl object-cover opacity-95 shadow-sm" alt="" />
        <div class="flex min-w-0 flex-1 flex-col justify-between py-1">
          <div>
            <div class="mb-1.5 font-mono text-[0.6rem] tracking-[0.08em] text-gray-400">{{ item.date }}</div>
            <div class="line-clamp-2 font-serif text-sm font-medium leading-tight text-gray-900">
              {{ item.playlistName }}
            </div>
            <div class="mt-1 text-[0.62rem] tracking-[0.16em] text-gray-400">{{ item.dominantColorName || '寻色' }}</div>
          </div>
          <div class="mt-3 flex h-2.5 w-full overflow-hidden rounded-full opacity-95 shadow-inner">
            <div v-for="(color, index) in item.palette" :key="`${item.id}-${color}-${index}`" :style="{ backgroundColor: color }" class="flex-1"></div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
