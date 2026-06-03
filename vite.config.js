import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl' // 引入 SSL 插件

export default defineConfig({
  plugins: [
    vue(),
    basicSsl() // 启用局域网 HTTPS
  ],
  server: {
    host: '0.0.0.0' // 允许局域网访问
  }
})