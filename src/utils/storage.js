// src/utils/storage.js

export const VibeStorage = {
  /**
   * 读取数据
   */
  async get(key) {
    // 🚀 未来扩展点：如果你打包成了 App，在这里判断环境并调用原生 SDK
    // if (window.Capacitor) {
    //   const { value } = await Capacitor.Preferences.get({ key })
    //   return value ? JSON.parse(value) : null
    // }
    
    // 👇 当前的浏览器兜底方案
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  },

  /**
   * 写入数据
   */
  async set(key, value) {
    // 🚀 未来扩展点：App 原生存储写入
    // if (window.Capacitor) {
    //   await Capacitor.Preferences.set({ key, value: JSON.stringify(value) })
    //   return true
    // }

    // 👇 当前的浏览器兜底方案（保留了之前的防爆盘机制）
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (e) {
      // 抛出错误交给业务层去处理（比如去挤掉旧数据）
      throw e 
    }
  }
}