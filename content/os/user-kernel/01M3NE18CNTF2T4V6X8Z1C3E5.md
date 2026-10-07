---
id: 01M3NE18CNTF2T4V6X8Z1C3E5
blockId: os/user-kernel
relatedBlocks: []
question: 上下文切换到底切换了什么？进程切换和线程切换差在哪？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 为什么说锁竞争的性能损失在切换上？
  - cs 很高怎么排查？
keyPoints:
  - id: kp-uk4-1
    text: 切换内容：寄存器+PC+内核栈——这是直接成本（微秒级）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNTE9Q2T4V6X8Z1C3
      - 01M3NE18CNTG4V6X8Z1C3E5G7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk4-2
    text: 隐形大头：CPU 缓存/TLB 被新上下文冲脏——间接成本更大
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNTE9Q2T4V6X8Z1C3
      - 01M3NE18CNTG4V6X8Z1C3E5G7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk4-3
    text: 进程切换额外换页表（CR3）——TLB 大换血
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS2A4C6E8G0K2M4N6Q
      - 01M3NE18CNTE9Q2T4V6X8Z1C3
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk4-4
    text: 线程同进程共享地址空间——切栈与寄存器即可
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS2A4C6E8G0K2M4N6Q
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk4-5
    text: 自愿切换（候 IO/锁）vs 抢占（时间片到）；vmstat cs 监控
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
---

**上下文切换**=CPU 从执行 A 换到执行 B 的搬家仪式：

```
直接成本（微秒级）：
  ① 保存 A 的寄存器/PC → 存入 A 的内核栈/任务结构
  ② 调度器挑出 B，恢复 B 的寄存器
  ③ 进程切换再 +：换页表基址（CR3）——TLB 大面积失效
隐形成本（更大且难计量）：
  ④ L1/L2 缓存里全是 A 的热数据——B 一来全污染，B 的冷启动
  ⑤ TLB 失效后的多次页表 walk
```

**进程 vs 线程切换的差价**全在③：线程共享地址空间——**页表不换、TLB 保住**；进程要换页表刷 TLB，随后一段时间的每次内存访问都在「缓存冷启动」。所以**同进程线程池**比**多进程**切换便宜——以及为什么**绑核**（CPU affinity）对性能敏感服务有效（缓存不流浪）。

**两种触发**：**自愿**（A 调 read 候 IO/抢锁失败——主动让出）vs **抢占**（时钟节拍发现 A 时间片用完）。**锁竞争的真实账单**：抢不到锁的线程挂起+唤醒=两次切换+缓存污染——临界区太小时，「锁的开销」全在切换而非锁本身（自旋锁因此存在）。

**监控**：`vmstat 1` 的 **cs 列**（每秒切换数）——数十万以上且 sys% 高就要查（上下文太多：锁竞争/IO 候/线程数超核数）。

**术语速查**：搬家=寄存器的交接|TLB 换血=进程切换的加价|缓存污染=看不见的大头

<!--advanced-->
 involuntary context switch 与调度延迟（runqueue 深度）。cgroup cpu.shares 与容器的切换公平。io_uring/goroutine 的哲学（少切换比快切换更值）。
