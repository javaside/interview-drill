/**
 * 题解分层（内容规范 v2）：detail 正文用 `<!--advanced-->` 分隔——
 * 前段是入门版（零基础可读，类比讲解），后段是进阶版（面试深度）。
 * 无标记的旧内容：全文视为入门版，进阶为空（渲染层自然退化为单层）。
 */
export function splitDetail(detail: string): { intro: string; advanced: string } {
  const marker = '<!--advanced-->'
  const idx = detail.indexOf(marker)
  if (idx === -1) return { intro: detail.trim(), advanced: '' }
  return {
    intro: detail.slice(0, idx).trim(),
    advanced: detail.slice(idx + marker.length).trim(),
  }
}
