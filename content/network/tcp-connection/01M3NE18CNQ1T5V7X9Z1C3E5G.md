---
id: 01M3NE18CNQ1T5V7X9Z1C3E5G
blockId: network/tcp-connection
relatedBlocks:
  []
question: "TCP 拥塞控制的四个阶段？"
cardType: sequence
appliesTo: 通用
frequency: high
followUps:
  - 慢启动明明指数增长为什么叫慢？
  - BBR 改了什么？
keyPoints:
  - id: kp-cc1-1
    text: "慢启动：cwnd 从小值指数翻倍，直到阈值 ssthresh"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-cc1-2
    text: "拥塞避免：过阈值后每 RTT 只加 1，线性爬升"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-cc1-3
    text: "拥塞发生：超时则 cwnd 打回 1 重来慢启动"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-cc1-4
    text: "快速恢复：三次冗余 ACK 则 cwnd 减半继续线性（Reno）"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
  - id: kp-cc1-5
    text: "AIMD 是骨架：加性增（线性+1）、乘性减（减半）"
    public: false
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9293.html
      locator: 'RFC 9293'
---

**拥塞控制**站在流量控制之外回答另一个问题：**网络本身受得了多少**（rwnd 只管接收方缓冲，不管链路拥堵）。发送窗口实为 **min(rwnd, cwnd)**——cwnd 是发送方对网络容量的**试探估计**，四个阶段循环：

```
慢启动：cwnd=1 → 2 → 4 → 8 …（每 RTT 翻倍，指数）……到 ssthresh
拥塞避免：每 RTT +1（线性慢爬）………………直到丢包
  ├─ 超时（重度拥塞）：cwnd=1、ssthresh=当前一半，重回慢启动
  └─ 3 个冗余 ACK（轻度）：ssthresh 与 cwnd 减半，快速恢复后线性爬升
```

**「慢」启动慢在哪**：不是增长慢，而是**起点慢**（从 1 起步而非满速灌入）——对比旧时代的「一上来全量发送」是灾难。这套 **AIMD**（加性增乘性减）的数学美感：多流竞争时各自减半再同步爬升，**收敛到公平分享**。

**术语速查**：cwnd=网络容量的试探值｜ssthresh=激进的终点线｜AIMD=线性加、减半罚

<!--advanced-->
CUBIC（Linux 默认——用三次函数替代线性爬升，高 BDP 网络更快填满管道）。BBR（Google——不靠丢包信号，测带宽与 RTT 建模瓶颈，深缓冲下不再排队）。ssthresh 的动态调整与早期重传对它的干扰。
