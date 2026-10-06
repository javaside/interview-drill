---
id: 01M3NE18CNRS5X5Z7D9F1H3
blockId: network/io-multiplexing
relatedBlocks: []
question: epoll 的水平触发和边缘触发？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - ET 丢数据吗？
  - 为什么 Nginx 用 ET？
keyPoints:
  - id: kp-io3-1
    text: LT 水平触发：只要缓冲区还有数据，每次 epoll_wait 都报你
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io3-2
    text: ET 边缘触发：仅在状态跃变（无→有）时通知一次
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io3-3
    text: ET 必须一次读干（循环 read 到 EAGAIN），否则残留数据不再提醒
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io3-4
    text: ET 必须配非阻塞 fd——阻塞 read 最后一口气会卡死
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io3-5
    text: LT 容错高是默认；ET 少唤醒高效但对写循环要求严苛
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
---

两种「叫你的时机」：

- **LT（水平触发）**：像水位警报——**缓冲区还有水（数据没读完）就一直响**。编程模型宽容：这次没读完？下次 epoll_wait 还会报，慢慢来；
- **ET（边缘触发）**：像**变化警报**——只在「无数据→有数据」的**跳变沿**叫你**一次**。听完就必须**一口气把缓冲区读干**（循环 read 直到 EAGAIN）；残留的话——**不会再提醒**，数据滞留到下次新数据到达（对端还以为你收到了，滑动窗口卡住）。

**ET 的两条铁律**：①读干循环；②**必须非阻塞 fd**——读干循环的最后一次 read 必然「无数据」，阻塞模式下这次 read 会把线程挂死在原地。

**取舍**：LT 是默认（Nginx 默认 LT、Redis 也是 LT——**容错优先**）；ET 减少重复唤醒、配合非阻塞一次读干**吞吐更高**（Nginx 可配 ET，高性能代理常用）——代价是写循环出错就出隐性 bug。

**术语速查**：LT=有货就叫|ET=来货那一下叫|读干=循环到 EAGAIN

<!--advanced-->
ET 与 ONESHOT 的组合（多线程 Reactor 防两线程同时处理同一 fd）。epoll 事件丢失的经典事故（读一半挂了，缓冲残留无人唤醒——keepalive 也救不了，需业务超时兜底）。信号中断的 EINTR 处理。
