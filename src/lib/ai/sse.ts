/**
 * SSE（Server-Sent Events）极简解析纯核，零依赖、零 IO。
 *
 * 两处复用同一份实现：
 * 1. 服务端解析 provider 的流式响应（OpenAI 兼容 `data: {...}` 帧）；
 * 2. 客户端解析**我们自己的** `/api/qa` 流（同一套帧格式）。
 *
 * 增量语义：网络到达的字节会任意切分，帧边界可能落在两次 read 之间——
 * `parseSseChunks` 返回未完成的尾巴（rest），调用方拼回下次输入即可。
 * 只认 `data:` 字段（本项目不用 event:/id:/retry:），注释行与心跳行忽略。
 */

export type SseFrame = { data: string }
export type SseParseResult = { frames: SseFrame[]; rest: string }

/** 单个帧的载荷：拼接该帧所有 data 行（SSE 规范：多行以 \n 连接） */
function frameOf(raw: string): SseFrame | null {
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    const l = line.endsWith('\r') ? line.slice(0, -1) : line
    if (l === '' || l.startsWith(':')) continue        // 空行 / 注释（含心跳）
    if (!l.startsWith('data:')) continue               // event:/id:/retry: 一概忽略
    const value = l.slice('data:'.length)
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
  }
  return dataLines.length === 0 ? null : { data: dataLines.join('\n') }
}

/**
 * 增量解析：切出所有已完整的帧（以空行分隔），返回未完成的尾巴。
 * 输入永远不抛错——半截帧原样留在 rest 里等下次。
 * CRLF 先归一到 LF（SSE 允许 \r\n 分隔，而 `\r\n\r\n` 里搜不到 `\n\n`）：
 * 归一化是幂等的，故尾巴 rest 与后续块拼接后仍能正确断帧。
 */
export function parseSseChunks(buffer: string): SseParseResult {
  const frames: SseFrame[] = []
  let rest = buffer.replace(/\r\n/g, '\n')
  for (;;) {
    const idx = rest.indexOf('\n\n')
    if (idx === -1) break
    const frame = frameOf(rest.slice(0, idx))
    rest = rest.slice(idx + 2)
    if (frame !== null) frames.push(frame)
  }
  return { frames, rest }
}

/** 拼一个帧（载荷内含换行时按规范拆成多行 data，避免破坏帧边界） */
export function encodeSseFrame(data: string): string {
  return `${data.split('\n').map(l => `data: ${l}`).join('\n')}\n\n`
}

/**
 * 从 provider 的流式帧里抽增量文本（OpenAI 兼容：choices[0].delta.content）。
 * `[DONE]`、心跳、只带 role 的首帧、以及任何解析不了的载荷都返回 null——不抛错。
 */
export function sseDeltaOf(data: string): string | null {
  if (data === '[DONE]') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  const content = (parsed as { choices?: Array<{ delta?: { content?: unknown } }> })
    ?.choices?.[0]?.delta?.content
  return typeof content === 'string' && content !== '' ? content : null
}

/**
 * 从 provider 的流式帧里抽**思考**增量（DeepSeek 等推理模型的 reasoning_content）。
 * 思考型模型会先吐几秒思考再吐正文——把这段显示出来，用户不必对着空白等
 * （实测 DeepSeek：思考 594ms 就开始到达，正文要等到约 5s）。
 */
export function sseReasoningOf(data: string): string | null {
  if (data === '[DONE]') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  const content = (parsed as { choices?: Array<{ delta?: { reasoning_content?: unknown } }> })
    ?.choices?.[0]?.delta?.reasoning_content
  return typeof content === 'string' && content !== '' ? content : null
}

/**
 * 兼容兜底：从**整包**（非流式）响应里取正文 choices[0].message.content。
 * 用在「provider 忽略了 stream 参数」的场景——拿到的是完整 JSON 而非 SSE 帧。
 */
export function chatAnswerOf(jsonText: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }
  const content = (parsed as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.trim() !== '' ? content : null
}
