<script setup>
const emit = defineEmits(['capture', 'gallery', 'diary'])
</script>

<template>
  <section class="w-full">
    <div class="animate-float mt-8 flex w-full justify-center gap-5">
      <button
        type="button"
        class="group relative flex h-36 w-32 flex-col items-center justify-center rounded-[2rem] border-[0.5px] border-white/80 bg-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-500 hover:scale-105 hover:bg-white/50 hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] active:scale-95"
        @click="emit('capture')"
      >
        <span class="mb-3 text-3xl transition-transform group-hover:scale-110">📷</span>
        <span class="text-[0.65rem] tracking-[0.15em] text-gray-500 group-hover:text-gray-800">捕捉此刻</span>
      </button>

      <button
        type="button"
        class="group relative flex h-36 w-32 flex-col items-center justify-center rounded-[2rem] border-[0.5px] border-white/80 bg-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-500 hover:scale-105 hover:bg-white/50 hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] active:scale-95"
        @click="emit('gallery')"
      >
        <span class="mb-3 text-3xl transition-transform group-hover:scale-110">🖼️</span>
        <span class="text-[0.65rem] tracking-[0.15em] text-gray-500 group-hover:text-gray-800">读取相册</span>
      </button>
    </div>

    <div class="mt-12 flex w-full justify-center animate-fade-in" style="animation-delay: 0.3s;">
      <button
        type="button"
        class="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-gray-700 active:scale-95"
        @click="emit('diary')"
      >
        <svg class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        我的情绪手账
      </button>
    </div>
  </section>
</template>
