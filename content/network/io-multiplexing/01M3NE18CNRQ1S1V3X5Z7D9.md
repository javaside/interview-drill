---
id: 01M3NE18CNRQ1S1V3X5Z7D9
blockId: network/io-multiplexing
relatedBlocks: []
question: 阻塞、非阻塞、同步、异步 IO 的区别？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 非阻塞配轮询为什么不行？
  - epoll 属于异步 IO 吗？
keyPoints:
  - id: kp-io1-1
    text: 阻塞 IO：read 无数据就挂起线程，直到数据就绪才返回
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io1-2
    text: 非阻塞 IO：read 立即返回，没数据报 EWOULDBLOCK——轮询由你
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRT7Z7D9F1H3J5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io1-3
    text: IO 多路复用：一个线程用 select/epoll 同时盯多个 fd 就绪
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRT7Z7D9F1H3J5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io1-4
    text: 同步/异步分界：数据搬运谁做——自己做是同步，代劳完再回调是异步
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
  - id: kp-io1-5
    text: 异步 IO：发起读后立即返回，内核填好缓冲再通知你（io_uring/IOCP）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: epoll(7)
misconceptions:
  - id: mc-io1-1
    text: "epoll 属于异步 IO：事件到达时内核已经把数据拷进用户缓冲区，拿来就能用"
    why: "误解：epoll 只做就绪通知，从内核到用户缓冲区的搬运仍要自己 read；连搬运都不用做的才叫异步（io_uring/IOCP）"
  - id: mc-io1-2
    text: "异步 IO 就是开一个后台线程去做阻塞 read，只要主线程不卡就算异步了"
    why: "误解：那只是拿线程池包住阻塞 IO，「候与搬」一步没少；内核把数据填进缓冲再通知你，才是真异步"
---

两个独立维度常被搅在一起：**「候不候」**（阻塞/非阻塞）与**「搬不搬」**（同步/异步）：

```
阻塞 IO    ：read 挂线程候数据 → 就绪后拷贝到用户缓冲 → 返回
非阻塞 IO  ：read 立刻返回（没数据报 EWOULDBLOCK）→ 你自己循环再试
IO 多路复用：把「候多个 fd」外包给 select/epoll——一次系统调用候一批，
             谁就绪返回谁，随后 read 必然不候
异步 IO    ：aiocb/io_uring 递交读请求立即返回，内核把数据拷好再通知
             ——「候」和「搬」都不用你管
```

**同步/异步的分水岭在「数据拷贝」**：前三种 read 返回时**你自己触发/经历拷贝**（同步）；异步 IO 连拷贝都由内核完成才通知你。所以 **epoll 不是异步 IO**——它只是「同步非阻塞」的高效组织形式（候的效率革命，搬运仍自己做；io_uring 才是真异步）。

**为什么非阻塞裸轮询不行**：一个 fd 就吃满一个 CPU；上万个 fd 就是灾难。多路复用的价值=**一次系统调用候一群**。

**术语速查**：阻塞=候在原地|多路复用=雇个哨兵候一群|真异步=连搬都不用你

<!--advanced-->
POSIX AIO 的历史残缺与 io_uring 的现状（提交/完成双环）。Windows IOCP 的成熟（IOCP 模型早 Linux 一代）。信号驱动 IO（SIGIO——边缘触发难处理，少用）。
