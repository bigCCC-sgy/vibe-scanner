// 文件路径：api/vibe.js

export default async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' })
  }

  // 🛑 注意：这里的环境变量不再以 VITE_ 开头了！
  // 它运行在 Node.js 服务器端，前端绝对看不到
  const apiKey = process.env.QWEN_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: '服务器未配置 API Key' })
  }

  try {
    // 我们的中间人代替前端，去请求阿里云
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      // 把前端传过来的模型、图片和 Prompt 直接原封不动发给阿里云
      body: JSON.stringify(req.body)
    })
    
    const data = await response.json()
    // 把阿里云的返回结果，原封不动吐给前端
    return res.status(200).json(data)

  } catch (error) {
    console.error('代理请求崩溃:', error)
    return res.status(500).json({ error: 'AI 请求失败' })
  }
}