---
id: 01M3NCQ6WZCBCQ402KD1EGFN27
blockId: mq/mq-problems
relatedBlocks: []
question: 消息丢失的三段排查？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 怎么证明到底丢没丢？
keyPoints:
  - id: kp-mp1-1
    text: 生产段：发送无确认/确认被忽略——acks=all+失败重试+本地消息表
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZ8A7RXJJMTBCSZWHW
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp1-2
    text: 存储段：单副本/刷盘未落——多副本+min.insync.replicas
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ83YT2YSABFFVPAST
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp1-3
    text: 消费段：先提交后处理或异常被吞——手动提交加idempotent
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WYSMTEEETJJ2XH9FBX
      - 01M3NCQ6WZ2YRJHBP2A6CJ4W7R
      - 01M3NCQ6WZC00C1NKK1Y7X64MR
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp1-4
    text: 定位手段：traceId 全链路追踪 + 生产/消费两端对账
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WY92YKR2DWS380WRQF
      - 01M3NCQ6WZ6MQVQ9GJCQ4QT23Y
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-mp1-5
    text: 生产回调记日志让发送失败可观测
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NCQ6WZ6MQVQ9GJCQ4QT23Y
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
misconceptions:
  - id: mc-mp1-1
    text: "丢消息只可能发生在 broker 宕机，生产端与消费端两个环节不会丢"
    why: "误解：最常见的丢失恰恰在两端——发送无确认或回调被吞、先提交后处理，排查必须三段全覆盖"
  - id: mc-mp1-2
    text: "消费端改成手动提交就绝不丢，处理异常 catch 住继续提交也没问题"
    why: "误解：吞掉异常继续提交是假成功，位点前移了活却没干，消息无声丢失，失败必须不签收走重试"
---

「**消息丢了**」的三段排查（背下三段各自的保险）：

1. **生产段**（最常见）：fire-and-forget、回调异常被吞——**acks=all + 重试 + 发送回调记日志**；金融再上本地消息表（先落库再发，失败扫描重投）；
2. **存储段**：单副本掉电、ISR 收缩写入——**副本≥3 + min.insync.replicas≥2 + 跨机架**；
3. **消费段**：自动提交的「先提交后处理」窗口、catch 吞异常——**手动提交 + 处理失败不签收**。

**证明丢没丢**：两端对账——生产侧流水表 vs 消费侧结果表按 **消息唯一 ID** 定期比对，差额即丢失量（还能顺带揪出重复）；traceId 贯穿三段定位具体环节。

**术语速查**：三段=生产/存储/消费｜对账=按 ID 数差异｜traceId=全链路的钩子

<!--advanced-->
Kafka 的 delivery.timeout 与 max.retries 组合；broker 端的 unclean 选举兜底讨论。消费组 rebalance 的重复窗口（commit 前 partition 易主）。对账的窗口粒度与告警分级。
