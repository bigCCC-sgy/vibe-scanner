// src/utils/colors.js

// 🎨 中国传统色全色系图鉴 (60色)
export const CHINESE_COLORS = [
  // 🔴 红色系
  { name: '胭脂', hex: '#95302E' }, { name: '朱砂', hex: '#FF461F' }, { name: '酡颜', hex: '#F9906F' },
  { name: '樱草', hex: '#EA9198' }, { name: '桃夭', hex: '#F6BAC4' }, { name: '妃色', hex: '#ED5736' },
  { name: '海棠', hex: '#DB5A6B' }, { name: '绛紫', hex: '#8C4356' }, { name: '丹赤', hex: '#ED5126' },
  { name: '彤色', hex: '#F35336' },
  // 🟡 黄橘系
  { name: '缃叶', hex: '#ECD452' }, { name: '秋香', hex: '#D9B611' }, { name: '琥珀', hex: '#CA6924' },
  { name: '鹅黄', hex: '#FFF143' }, { name: '藤黄', hex: '#FFD400' }, { name: '柳黄', hex: '#C9DD22' },
  { name: '姜黄', hex: '#E2C027' }, { name: '赤金', hex: '#F2BE45' }, { name: '杏黄', hex: '#FFA631' },
  // 🟢 绿色系
  { name: '竹青', hex: '#789262' }, { name: '翠微', hex: '#4C8045' }, { name: '苍葭', hex: '#A8BF8F' },
  { name: '碧色', hex: '#1BD1A5' }, { name: '葱绿', hex: '#9ED048' }, { name: '艾绿', hex: '#A4E2C6' },
  { name: '松柏', hex: '#21A675' }, { name: '苔绿', hex: '#5B7E5A' }, { name: '石绿', hex: '#16A951' },
  { name: '缥色', hex: '#7BCFA6' },
  // 🔵 青蓝系
  { name: '天水', hex: '#5AA4AE' }, { name: '靛青', hex: '#1661AB' }, { name: '黛蓝', hex: '#425066' },
  { name: '霁青', hex: '#63BFC1' }, { name: '群青', hex: '#4C8DAE' }, { name: '藏青', hex: '#2E4E7E' },
  { name: '沧浪', hex: '#B8F4FF' }, { name: '宝蓝', hex: '#4B5CC4' }, { name: '景泰', hex: '#2775B6' },
  { name: '水色', hex: '#88ADA6' },
  // 🟣 紫色系
  { name: '丁香', hex: '#CCA4E3' }, { name: '暮紫', hex: '#A486CE' }, { name: '藕荷', hex: '#E4C6D0' },
  { name: '雪青', hex: '#B0A4E3' }, { name: '藤萝', hex: '#8076A3' }, { name: '紫棠', hex: '#56004F' },
  { name: '槿紫', hex: '#806D9E' },
  // ⚪⚫ 黑白灰系
  { name: '月白', hex: '#D6ECF0' }, { name: '远山', hex: '#8FA1AC' }, { name: '云峰', hex: '#D8E3E7' },
  { name: '蟹青', hex: '#BBCBC2' }, { name: '缟素', hex: '#F2F2F2' }, { name: '漆黑', hex: '#161823' },
  { name: '玄色', hex: '#22202E' }, { name: '鸦青', hex: '#424C50' }, { name: '苍灰', hex: '#737C7B' },
  { name: '霜色', hex: '#E9F1F6' }, { name: '铅灰', hex: '#8A8C8E' }, { name: '墨色', hex: '#50616D' }
]

// 🧠 核心算法：计算色彩空间距离，自动匹配最近的传统色
export function getChineseColorName(hexStr) {
  if (!hexStr) return '寻色'
  
  const r1 = parseInt(hexStr.slice(1, 3), 16) || 0
  const g1 = parseInt(hexStr.slice(3, 5), 16) || 0
  const b1 = parseInt(hexStr.slice(5, 7), 16) || 0

  let minDistance = Infinity
  let closestName = '寻色'

  for (const c of CHINESE_COLORS) {
    const r2 = parseInt(c.hex.slice(1, 3), 16) || 0
    const g2 = parseInt(c.hex.slice(3, 5), 16) || 0
    const b2 = parseInt(c.hex.slice(5, 7), 16) || 0

    const distance = Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
    if (distance < minDistance) {
      minDistance = distance
      closestName = c.name
    }
  }
  return closestName
}