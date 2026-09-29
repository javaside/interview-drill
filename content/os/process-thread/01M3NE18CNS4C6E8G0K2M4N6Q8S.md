---
id: 01M3NE18CNS4C6E8G0K2M4N6Q8S
blockId: os/process-thread
relatedBlocks:
  []
question: "进程间通信方式怎么选？"
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 为什么共享内存最快？
  - Unix socket 和 TCP socket 选哪个？
keyPoints:
  - id: kp-pt3-1
    text: "管道：父子血缘间字节流——shell 的 | 就是它"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'proc(5)'
  - id: kp-pt3-2
    text: "消息队列：内核维护的有格式消息——可分类型取"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'proc(5)'
  - id: kp-pt3-3
    text: "共享内存+信号量：同块物理内存映射两进程——最快，配信号量同步"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'proc(5)'
  - id: kp-pt3-4
    text: "信号：异步通知（kill/定时器）——只能带个编号"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'proc(5)'
  - id: kp-pt3-5
    text: "socket：跨机通吃——本地走 Unix domain socket 零网络栈"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'proc(5)'
---

IPC 全家福按「**传什么、多快、跨不跨机**」选：

| 方式 | 形态 | 速度 | 适用 |
|---|---|---|---|
| **管道** | 单向字节流 | 中（两次拷贝） | **血缘进程**——shell `a | b` |
| **消息队列** | 有边界的消息（可带类型） | 中 | 少量结构化指令 |
| **共享内存 + 信号量** | 同一物理内存映射两方 | **最快（零拷贝）** | **大数据量高频**——DB 缓冲区、MQ 零拷贝 |
| **信号** | 一个编号的异步通知 | — | 事件通知（kill/超时），不传数据 |
| **socket** | 双向流/报文 | 中 | **跨机唯一解**；本机用 Unix domain socket（不走网络栈，更快） |

**共享内存快的原因**：别的 IPC 两次拷贝（用户→内核→对方用户），共享内存**映射同一块物理页**——写完对方立刻可见，内核零参与；代价是**没有同步**——得自己配信号量/原子变量防踩脚。

**本机通信选 Unix domain socket**：不走 TCP/IP 栈（无打包/校验/环回），也不占端口——**容器内通信/本机服务间**的事实标准（Docker daemon、MySQL 本机连接都是它）。

**术语速查**：两次拷贝=管道的税|零拷贝=共享内存的超能力|Unix socket=本机直通走廊

<!--advanced-->
eventfd（内核事件计数器——现代 epoll 服务的唤醒利器）。mmap MAP_SHARED 的匿名共享（无文件的 shm 替代）。Android Binder（进程 IPC 的工程魔改）。
