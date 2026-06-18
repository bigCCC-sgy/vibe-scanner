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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 88000)

  try {
    // 我们的中间人代替前端，去请求阿里云
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      // 把前端传过来的模型、图片和 Prompt 直接原封不动发给阿里云
      body: JSON.stringify(req.body),
      signal: controller.signal
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch (error) {
      data = { error: { message: text || '上游返回了非 JSON 响应', code: 'invalid_upstream_response' } }
    }

    if (!response.ok) {
      console.error('DashScope 返回错误:', {
        status: response.status,
        code: data?.error?.code,
        message: data?.error?.message
      })
      return res.status(response.status).json({
        ...data,
        upstreamStatus: response.status
      })
    }

    return res.status(200).json(data)

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('DashScope 请求超时')
      return res.status(504).json({ error: { code: 'ai_timeout', message: 'AI 解析超时，请稍后再试' } })
    }

    console.error('代理请求崩溃:', error)
    return res.status(500).json({ error: { code: 'proxy_error', message: 'AI 请求失败' } })
  } finally {
    clearTimeout(timeout)
  }
}
