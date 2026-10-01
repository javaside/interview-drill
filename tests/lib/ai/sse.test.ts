import { parseSseChunks, encodeSseFrame, sseDeltaOf, chatAnswerOf } from '../../../src/lib/ai/sse.js'

/** 把整段文本按固定长度切碎（模拟网络任意切分），逐块喂给解析器 */
function feedInChunks(text: string, size: number): string[] {
  const out: string[] = []
  let buffer = ''
  for (let i = 0; i < text.length; i += size) {
    buffer += text.slice(i, i + size)
    const { frames, rest } = parseSseChunks(buffer)
    buffer = rest
    for (const f of frames) out.push(f.data)
  }
  return out
}

test('解析单帧：data: 前缀剥掉，帧以空行分隔', () => {
  const { frames, rest } = parseSseChunks('data: hello\n\ndata: world\n\n')
  expect(frames.map(f => f.data)).toEqual(['hello', 'world'])
  expect(rest).toBe('')
})

test('增量边界：帧被任意切分也不丢内容（逐字节喂一遍）', () => {
  const body = 'data: 第一段\n\ndata: {"a":1}\n\ndata: 第三段\n\n'
  expect(feedInChunks(body, 1)).toEqual(['第一段', '{"a":1}', '第三段'])
  expect(feedInChunks(body, 3)).toEqual(['第一段', '{"a":1}', '第三段'])
  expect(feedInChunks(body, 7)).toEqual(['第一段', '{"a":1}', '第三段'])
  // 切在多字节字符中间（中文 3 字节）也不该炸——这里按 UTF-16 码元切
  expect(feedInChunks('data: 中文字符\n\n', 2)).toEqual(['中文字符'])
})

test('半截帧留在 rest 里等下次（不吐未完成的帧）', () => {
  const { frames, rest } = parseSseChunks('data: 完整\n\ndata: 未完')
  expect(frames.map(f => f.data)).toEqual(['完整'])
  expect(rest).toBe('data: 未完')

  // 续上后能补完
  const next = parseSseChunks(`${rest}成\n\n`)
  expect(next.frames.map(f => f.data)).toEqual(['未完成'])
})

test('忽略注释行（心跳）、event/id/retry 字段与 CRLF 换行', () => {
  const body = ': 心跳\n\nevent: ping\ndata: 真的\n\nid: 7\nretry: 100\ndata: 也是\n\n'
  const { frames } = parseSseChunks(body)
  expect(frames.map(f => f.data)).toEqual(['真的', '也是'])
})

test('CRLF（\\r\\n）帧边界同样识别，且切在 \\r|\\n 之间也不丢帧', () => {
  const { frames } = parseSseChunks('data: a\r\n\r\ndata: b\r\n\r\n')
  expect(frames.map(f => f.data)).toEqual(['a', 'b'])
  // 增量场景：切点正好落在 \r 与 \n 之间（CRLF 里搜不到 \n\n 的经典坑）
  expect(feedInChunks('data: 甲\r\n\r\ndata: 乙\r\n\r\n', 1)).toEqual(['甲', '乙'])
  expect(feedInChunks('data: 甲\r\n\r\ndata: 乙\r\n\r\n', 5)).toEqual(['甲', '乙'])
})

test('同帧多行 data 按规范以换行拼接', () => {
  const { frames } = parseSseChunks('data: 第一行\ndata: 第二行\n\n')
  expect(frames[0]?.data).toBe('第一行\n第二行')
})

test('只有 data: 无冒号后空格也能解析；空帧被丢弃', () => {
  expect(parseSseChunks('data:紧凑\n\n').frames[0]?.data).toBe('紧凑')
  expect(parseSseChunks('\n\n\n\n').frames).toEqual([])
  expect(parseSseChunks('').frames).toEqual([])
})

test('encodeSseFrame：往返一致，载荷含换行时拆成多行 data 不破坏帧边界', () => {
  const one = parseSseChunks(encodeSseFrame('{"type":"done"}'))
  expect(one.frames[0]?.data).toBe('{"type":"done"}')

  const multi = parseSseChunks(encodeSseFrame('第一行\n第二行'))
  expect(multi.frames).toHaveLength(1)                    // 仍是一帧
  expect(multi.frames[0]?.data).toBe('第一行\n第二行')    // 内容原样还原
})

test('sseDeltaOf：取增量文本；[DONE]/心跳/空增量/坏 JSON 一律 null（不抛错）', () => {
  const frame = (delta: unknown): string => JSON.stringify({ choices: [{ delta }] })
  expect(sseDeltaOf(frame({ content: '你好' }))).toBe('你好')
  expect(sseDeltaOf(frame({ content: '' }))).toBeNull()
  expect(sseDeltaOf(frame({ role: 'assistant' }))).toBeNull()   // 只带 role 的首帧
  expect(sseDeltaOf('[DONE]')).toBeNull()
  expect(sseDeltaOf('not json')).toBeNull()
  expect(sseDeltaOf('{}')).toBeNull()
  expect(sseDeltaOf(JSON.stringify({ choices: [] }))).toBeNull()
  expect(sseDeltaOf(JSON.stringify({ choices: [{ delta: { content: 42 } }] }))).toBeNull()
})

test('chatAnswerOf：整包（非流式）响应取 message.content 兜底', () => {
  expect(chatAnswerOf(JSON.stringify({ choices: [{ message: { content: '完整回答' } }] }))).toBe('完整回答')
  expect(chatAnswerOf(JSON.stringify({ choices: [{ message: { content: '   ' } }] }))).toBeNull()
  expect(chatAnswerOf('{ bad json')).toBeNull()
  expect(chatAnswerOf(JSON.stringify({ choices: [] }))).toBeNull()
})
