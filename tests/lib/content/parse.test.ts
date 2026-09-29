import { parseCard } from '../../../src/lib/content/parse.js'
const SRC = `---
id: 01J8ZKQ7Y0000000000000000A
blockId: concurrency/aqs
relatedBlocks: []
question: AQS 是怎么实现独占锁的？
cardType: enumeration
appliesTo: JDK 8+
frequency: high
followUps:
  - 为什么等待队列是双向的？
keyPoints:
  - id: kp-1
    text: state 是 volatile int，表示同步状态
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#state
  - id: kp-2
    text: 获取锁是对 state 做 CAS，成功即持有
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#acquire
  - id: kp-3
    text: CAS 失败则把线程包装成 Node，入队列尾部
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    source:
      kind: source-code
      url: https://github.com/openjdk/jdk/blob/master/AQS.java
      locator: AbstractQueuedSynchronizer#addWaiter
---

AQS 是 JUC 的基础同步框架。`

test('解析出完整的 Card', () => {
  const r = parseCard(SRC, 'content/concurrency/aqs/01J8.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.id).toBe('01J8ZKQ7Y0000000000000000A')
  expect(r.card.cardType).toBe('enumeration')
  expect(r.card.keyPoints).toHaveLength(3)
  expect(r.card.keyPoints[0]!.public).toBe(true)
  expect(r.card.detail.trim()).toBe('AQS 是 JUC 的基础同步框架。')
})

test('schema 不合法时返回错误而非抛异常，且带上文件路径', () => {
  const bad = SRC.replace('cardType: enumeration', 'cardType: essay')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('content/x/y.md')
})

test('触发 KP5 承载词的要点在解析阶段就被报出', () => {
  const bad = SRC.replace('表示同步状态', '表示同步状态等信息')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('承载词')
})

test('缺 frontmatter 时报错不崩，且说清缺了什么', () => {
  const r = parseCard('只有正文没有 frontmatter', 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.length).toBeGreaterThan(0)
  expect(r.issues.join()).toContain('frontmatter')
  expect(r.issues.join()).toContain('content/x/y.md')
})

test('frontmatter 里写 detail 被拒 —— 否则会被正文静默覆盖', () => {
  const bad = SRC.replace('keyPoints:', 'detail: 我不该出现在这里\nkeyPoints:')
  const r = parseCard(bad, 'x.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('detail')
})

test('verifiedAt 必须保持字符串，不能被 YAML 当 timestamp 解析成 Date', () => {
  const r = parseCard(SRC, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(typeof r.card.keyPoints[0]!.verifiedAt).toBe('string')
  expect(r.card.keyPoints[0]!.verifiedAt).toBe('2026-09-18')
})

test('public 仍然是 boolean，没有被 JSON_SCHEMA 影响', () => {
  const r = parseCard(SRC, 'x.md')
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.card.keyPoints[0]!.public).toBe(true)
})

/** sequence 卡带 order 的最小合法骨架（顺序标号规则的宿主卡型） */
const SEQ_SRC = `---
id: 01J8ZKQ7Y0000000000000000B
blockId: network/tcp-connection
relatedBlocks: []
question: 三次握手的顺序？
cardType: sequence
appliesTo: 通用
frequency: high
followUps: []
keyPoints:
  - id: kp-1
    text: 客户端发 SYN 进 SYN_SENT 状态
    public: true
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    order: 1
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: RFC 9293
  - id: kp-2
    text: 服务端回 SYN+ACK 进 SYN_RCVD
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    order: 2
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: RFC 9293
  - id: kp-3
    text: 客户端回 ACK 双方 ESTABLISHED
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    order: 3
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: RFC 9293
  - id: kp-4
    text: 序号与确认号保证字节流有序不丢
    public: false
    verifiedAt: 2026-09-18
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    order: 4
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: RFC 9293
---

三次握手建立可靠连接。`

test('sequence 要点自带「第 N 步」标号被拒——排序题答案不得写在题面上', () => {
  const bad = SEQ_SRC.replace('text: 客户端发 SYN 进 SYN_SENT 状态', 'text: 第 1 步 客户端发 SYN 进 SYN_SENT 状态')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('顺序标号')
})

test('enumeration 要点带顺序叙述不触发该规则（顺序标号只对 sequence 泄题）', () => {
  const r = parseCard(SRC.replace('text: 获取锁是对 state 做 CAS，成功即持有', 'text: 获取锁先对 state 做 CAS，成功即持有'), 'x.md')
  expect(r.ok).toBe(true)
})

test('正文 ** 奇数个被拒——未配对标记会让后续粗体整体错位', () => {
  // 复刻 thread-pools 卡的真实损坏形状：5 组 **（奇数）
  const bad = SRC.replace('AQS 是 JUC 的基础同步框架。', '反直觉点在 **先排队、后扩编****：**「宁可攒着」**因为建线程贵。')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('未配对')
})

test('正文 ` 奇数个被拒——模板残留的孤立反引号会裸显在页面上', () => {
  const bad = SRC.replace('AQS 是 JUC 的基础同步框架。', '收敛范围。`,')
  const r = parseCard(bad, 'content/x/y.md')
  expect(r.ok).toBe(false)
  if (r.ok) return
  expect(r.issues.join()).toContain('未配对')
})
