---
id: 01M3NE18CNTN5G7K9S1V3X5Z7
blockId: os/linux-commands
relatedBlocks: []
question: load average 怎么读？高 load 但 CPU 闲是怎么回事？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - load 10 一定是坏事吗？
  - USE 方法论是什么？
keyPoints:
  - id: kp-lc5-1
    text: load=运行中+不可中断候 IO 的任务数（R+D 态）的滑动平均
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: uptime(1)
  - id: kp-lc5-2
    text: 1/5/15 分钟三个数看趋势：升/降/稳
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: uptime(1)
  - id: kp-lc5-3
    text: 判断要除以核数：8 核 load 7 不忙，2 核 load 7 已过载
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: uptime(1)
  - id: kp-lc5-4
    text: CPU 闲但 load 高：D 态任务堆积——磁盘/存储卡死（含 NFS）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: uptime(1)
  - id: kp-lc5-5
    text: 分诊顺序：vmstat r 与 b 列→top 找 D 进程→iostat 确认 IO
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: uptime(1)
---

**load average 的分子是两种人**：正在跑的（R）+**候磁盘 IO 的 D 态**（Linux 特色的计入方式）——1/5/15 分钟滑动平均：

```
$ uptime
load average: 7.2, 5.1, 3.8     ← 短期更高：正在恶化（1>5>15 是上升趋势）
```

**读法三步**：①**除以核数**（`nproc`）——load 7 在 32 核上闲庭信步、在 2 核上灾难现场（经验：**每核 <1 健康，>1~2 开始排队**）；②**三数趋势**——1>5>15 恶化中，15>5>1 正在恢复；③**结合 CPU 使用率交叉验证**。

**「load 高但 CPU 闲」的经典之谜**：分子里的 **D 态**在作怪——大量任务卡在**不可中断 IO**（磁盘坏/存储抖动/NFS 断连/swap 抖动）——CPU 无事可做、活全堵在 IO 队列。分诊：`vmstat 1` 的 **b 列**（不可中断块数）高企证实 → `ps -eo pid,stat,wchan:20,comm | awk '$2~/D/'` 列出 D 进程与卡点 → `iostat -x` 看哪块盘 await 飙。

**USE 方法论**（Brendan Gregg）：对每个资源看 **U**tilization（使用率）/**S**aturation（饱和度=排队）/**E**rrors（错误）——load 正是 CPU+IO 的**饱和度**指标——单看使用率会漏「忙而不满、满而排队」的病。

**术语速查**：R+D=load 的两种人|除以核数=体感换算|D 态堆积=load 高 CPU 闲的元凶

<!--advanced-->
 PSI（pressure stall information——Linux 4.20+：cpu/memory/io 各自的「卡了多少多久」，比 load 精确一个时代）。CPU 压力测试与 load 的人为噪声（压测时监控告警要摘除）。cgroup 的 cpu.max 与容器 load 视角。
