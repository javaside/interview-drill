---
id: 01M3NE18CNS2A4C6E8G0K2M4N6Q
blockId: os/process-thread
relatedBlocks:
  []
question: "进程和线程的区别？"
cardType: comparison
appliesTo: Linux
frequency: high
followUps:
  - 协程和线程什么关系？
  - 什么时候选多进程什么时候多线程？
keyPoints:
  - id: kp-pt1-1
    text: "进程=资源单位（独立地址空间/fd/内存）；线程=调度单位（共享进程资源）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'sched(7)'
  - id: kp-pt1-2
    text: "同进程多线程共享：代码/堆/全局变量/fd；私有：栈/寄存器/errno"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'sched(7)'
  - id: kp-pt1-3
    text: "切换成本：线程切换不换地址空间，进程切换连页表一起换"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'sched(7)'
  - id: kp-pt1-4
    text: "隔离性：进程崩溃互不牵连；线程一人崩全进程陪葬"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'sched(7)'
  - id: kp-pt1-5
    text: "通信成本：进程要 IPC（管道/共享内存），线程直接读写共享变量+锁"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: 'sched(7)'
---

记分水岭：**进程管资源、线程管执行**。

| 维度 | 进程 | 线程 |
|---|---|---|
| 本质 | **资源分配的单位**——一套独立地址空间+fd+内存 | **CPU 调度的单位**——寄存器+栈+执行流 |
| 共享什么 | 与别人什么都不共享 | **同进程内共享**：堆、全局变量、fd 表；**私有**：栈、寄存器、errno |
| 切换成本 | 高——换地址空间（切页表，TLB/缓存失效多） | 低——只换寄存器与栈指针 |
| 隔离 | 崩了互不影响（Chrome 多进程的理据） | 一个线程段错误全进程倒下 |
| 通信 | 要 IPC：管道/消息队列/共享内存 | 直接读写共享变量（代价：要同步原语） |

**选型经验**：要**隔离与稳定**（插件/多租户）选多进程；要**高并发共享数据**（Web 服务）选多线程+连接池；**协程**是用户态的「轻线程」——切换不进内核（纳秒级），把同步写法写出异步性能（Go goroutine/虚拟线程——本质是线程内再复用）。

**术语速查**：资源单位 vs 调度单位|私有栈=各自的执行现场|TLB 失效=切进程的隐形税

<!--advanced-->
Linux 的实现（task_struct 一视同仁——线程=共享 mm_struct 的 task，clone 的 flags 决定共享多少）。NPTL 的 1:1 模型 vs Go 的 M:N 调度。cgroup v2 与容器进程视图。
