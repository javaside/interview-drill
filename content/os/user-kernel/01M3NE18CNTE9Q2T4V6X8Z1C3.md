---
id: 01M3NE18CNTE9Q2T4V6X8Z1C3
blockId: os/user-kernel
relatedBlocks: []
question: 系统调用的开销在哪？为什么 strace 会让程序变慢？
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - 为什么 read 一整块比多次 read 一字节快？
  - glibc 的 buffered IO 帮了什么？
keyPoints:
  - id: kp-uk3-1
    text: 开销构成：模式切换（保存现场+切栈+安全检查）+内核逻辑本身
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk3-2
    text: syscall 指令百纳秒级——但内核逻辑可达微秒毫秒（read 触盘）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk3-3
    text: strace 用 ptrace 拦截每次调用——每个调用多两倍切换+打印
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk3-4
    text: 优化方向：减少次数（缓冲/批量/vDSO）而非单次加速
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk3-5
    text: 对比：一次系统调用 ≈ 上千次函数调用——高频小 IO 是反模式
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
---

一次系统调用的账单两部分：**「过门费」**（模式切换：保存寄存器/切内核栈/入口检查——`syscall` 指令本身 ~百 ns）+**「办事费」**（内核里实际干的活——可能触发磁盘就是毫秒级）。

**strace 的原理决定它慢**：`ptrace` 在**每次系统调用进出各拦一次**——每个调用凭空多两次陷入+两次唤醒+格式化打印；一秒十万次调用的服务能被拖慢**几十倍**。生产排查改用 **perf trace/ eBPF**（内核里直接统计，无拦截）。

**优化的主旋律是「少过门」**：

- **用户态缓冲**：glibc 的 fread/fwrite 攒 4KB 才真调用 read/write——**一万次 1 字节读变 3 次 4KB 读**（过门费摊薄千倍）；这也是自己写循环 `read(1)` 反直觉地慢的原因；
- **批量接口**：writev/io_submit/io_uring（一次递交一批）；
- **vDSO**：时钟读取这种高频调用，内核把数据映射进用户空间**直接读**（免门）。

**数字感**：函数调用 ~1ns、系统调用过门 ~100ns（百倍）、带缓存未命中的内核路径 ~μs、触盘 ~ms——**跨度六个数量级**，这正是「缓存为什么重要」的 OS 版注脚。

**术语速查**：过门费+办事费=账单两页|拦截=ptrace 的税|少过门=缓冲与批量

<!--advanced-->
 spectre 缓解对切换成本的影响（KPTI 页表隔离——2018 后每次切换更贵）。io_uring 的提交环（把一万次过门折叠成一次）。seccomp/eBPF 对调用流的过滤开销。
