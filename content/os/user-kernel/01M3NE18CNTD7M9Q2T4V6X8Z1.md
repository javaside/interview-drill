---
id: 01M3NE18CNTD7M9Q2T4V6X8Z1
blockId: os/user-kernel
relatedBlocks: []
question: 程序什么时候会陷入内核态？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 缺页是异常为什么不是坏事？
  - 软中断为什么占 CPU？
keyPoints:
  - id: kp-uk2-1
    text: 路 1 系统调用：主动请求服务（read/write/fork/socket）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk2-2
    text: 路 2 中断：硬件异步敲门（网卡包到/时钟节拍/磁盘完成）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk2-3
    text: 路 3 异常：执行出错（缺页/除零/越权访问）被动触发
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk2-4
    text: 三条路殊途同归：保存现场→进 Ring0 →处理→返回
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk2-5
    text: 时钟中断是调度的脉搏——没有它一个死循环独占 CPU
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
---

进内核只有**三条门**：

| 门 | 谁发起 | 例子 | 频率 |
|---|---|---|---|
| **系统调用** | 程序**主动** | read/write/fork/mmap/socket | 每秒成千上万 |
| **中断** | 硬件**异步**敲门 | 网卡包到、磁盘 IO 完成、**时钟节拍** | 不可控（流量大=中断风暴） |
| **异常** | CPU 执行**出错**被动 | 缺页、除零、越权地址 | 看程序健康度 |

三条门**仪式相同**：保存用户现场（寄存器/PC）→ 切 Ring0+内核栈 → 处理 → **iret 返回用户**继续。**缺页是异常但不全是错**——按需分配/COW/换入都是「故意让它缺」再由内核善后（良性缺页是虚拟内存的日常）。**时钟中断**是**调度的脉搏**：内核定期被节拍唤醒，检查「当前进程时间片用完没、有没有更高优先级就绪」——**没有它，一个 while(1) 就能独占整个核**（抢占式调度的地基）。

**软中断（si%）**：硬中断里只做最小动作，剩下的活（协议栈收包处理）推迟到软中断——高网络流量时 `top` 的 si 飙升——RSS/multi-queue 把收包分散到多核就是治它。

**术语速查**：主动申请/被动敲门/出错触发=三扇门|iret=回用户态的单程票|时钟=调度的脉搏

<!--advanced-->
vDSO（把 gettimeofday 做成用户态直读——免陷内核的官方外挂）。中断上下文的铁律（不能睡眠——不占进程上下文）。NAPI（中断+轮询混合——高流量网卡降噪）。
