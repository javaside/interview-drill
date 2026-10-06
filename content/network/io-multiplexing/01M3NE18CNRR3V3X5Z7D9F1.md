---
id: 01M3NE18CNRR3V3X5Z7D9F1
blockId: network/io-multiplexing
relatedBlocks: []
question: select、poll、epoll 的区别？
cardType: comparison
appliesTo: 通用
frequency: high
followUps:
  - 为什么 epoll 快？
  - 连接全活跃时 epoll 还有优势吗？
keyPoints:
  - id: kp-io2-1
    text: select：fd 集合上限 1024，每次调用全量传入+线性扫描
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io2-2
    text: poll：链表突破 1024，但仍是全量拷贝+O(n) 扫描
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io2-3
    text: epoll：内核建红黑树注册一次，就绪链表只返回活跃 fd
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io2-4
    text: epoll 复杂度 O(活跃数)——万连接少数活跃时碾压
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io2-5
    text: 共同点：三者都只是「就绪通知」，数据拷贝仍要自己 read
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
---

三者是**「怎么候一批 fd」**的三代方案：

| 维度 | select | poll | epoll |
|---|---|---|---|
| fd 上限 | **1024**（位图定死） | 无硬限（链表） | 无硬限（几十万常见） |
| 每次调用 | **全量 fd 集拷进内核** + 返回后**线性扫描**找就绪 | 同 select 的代价 | 注册一次进红黑树；**就绪的 fd 由回调挂进就绪链表**，epoll_wait 只取链表 |
| 复杂度 | O(n) 每次全扫 | O(n) | **O(活跃数)** |
| fd 传递 | 每次重复传 | 每次重复传 | **一次注册，长期有效** |

**epoll 快的两个根本**：①就绪集合**由事件回调在内核维护**（网卡数据到达→该 fd 挂入就绪链表），epoll_wait 只收获链表——不用全量重扫；②fd 集合**注册制**而非每次携带——省掉反复拷贝。

**边界**：**连接全活跃**（人人有数据）时 epoll 退化成也要逐个处理，优势缩小（甚至不如 poll 少一层注册）；它碾压的场景是**万级连接、少量活跃**（长连接网关/IM/推送——业界主流负载形态）。

**术语速查**：注册制=登记一次候到底|就绪链表=内核帮你挑好了|O(活跃)=只为你服务的对象付费

<!--advanced-->
epoll 的红黑树+就绪链表双结构（epoll_ctl 增删改查树，事件回调入链）。LT/ET 与 ET 配非阻塞 fd 的强制要求。惊群（accept 惊群与 EPOLLEXCLUSIVE/ SO_REUSEPORT 的现代解法）。
