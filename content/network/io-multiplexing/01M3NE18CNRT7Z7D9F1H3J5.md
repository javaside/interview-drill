---
id: 01M3NE18CNRT7Z7D9F1H3J5
blockId: network/io-multiplexing
relatedBlocks: []
question: Reactor 模式怎么组织高并发服务？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - Redis 单线程为什么快？
  - Netty 的 boss/worker 对应什么？
keyPoints:
  - id: kp-io4-1
    text: Reactor=事件循环：epoll 候事件，就绪后分发（dispatch）给处理器
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io4-2
    text: 单 Reactor 单线程：Redis 模型——简单无锁，但慢命令拖全场
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io4-3
    text: 单 Reactor 多 worker：IO 分发，计算丢线程池——业务隔离
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io4-4
    text: 主从 Reactor：主收连接、从各管一批连接的 IO（Netty/Memcached）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io4-5
    text: 对偶 Proactor：事件是「完成通知」而非「就绪通知」——真异步 IO 的框架形态
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
---

**Reactor** 把「一个线程候一批 fd + 就绪分发」固化成架构骨架，三代演进：

```
①单 Reactor 单线程（Redis 6.0 前）
  epoll → accept/read/解析/执行/写回 全在一个线程
  优：无锁无竞争、上下文切换极少；劣：一个慢命令全场卡

②单 Reactor + worker 池
  Reactor 线程只管 IO 收发，业务计算丢线程池——IO 与计算解耦

③主从 Reactor（Netty 的 boss/worker、Memcached）
  mainReactor（boss）：只管 accept 新连接
  subReactor（worker）：各持一个 epoll 管一批连接的读写
  —— 连接分发多核水平扩展，扛十万级连接的主力形态
```

**Redis 单线程快的原因**不在 Reactor 本身：纯内存操作（微秒级）+ 无锁无切换 + IO 多路复用足够喂饱——**瓶颈不在 CPU 在内存与网络**。慢命令（keys/*/大集合运算）才是它的天敌——所以 4.0+ 把最重的活（删键/持久化 fork）挪异步线程。

**术语速查**：事件循环=候铃+分发|boss/worker=接客与服务的分工|Proactor=完成通知型

<!--advanced-->
Group/多线程版本（Redis 6.0 的 IO threads 只并行 IO 解析，执行仍单线程有序）。Netty 的 Pipeline 与 handler 链（业务编排不阻塞 EventLoop 是铁律）。协程视角（Go netpoller=内核态 epoll+用户态调度——另一种消灭阻塞的路径）。
