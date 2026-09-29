---
id: 01M3NE18CNTH6X8Z1C3E5G7K9
blockId: os/linux-commands
relatedBlocks:
  []
question: "CPU 100% 怎么一步步定位？"
cardType: sequence
appliesTo: Linux
frequency: high
followUps:
  - us 和 sys 高分别说明什么？
  - 为什么是线程不是进程？
keyPoints:
  - id: kp-lc1-1
    text: "第 1 步 top 确认进程与 CPU 构成：us 用户/sys 内核/si 软中断"
    public: false
    order: 1
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: 'top(1)'
  - id: kp-lc1-2
    text: "第 2 步 top -H -p 找出进程内吃 CPU 的线程号"
    public: false
    order: 2
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: 'top(1)'
  - id: kp-lc1-3
    text: "第 3 步 线程号转十六进制，去线程栈/jstack 定位代码行"
    public: false
    order: 3
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: 'top(1)'
  - id: kp-lc1-4
    text: "第 4 步 按构成分诊：us 高查业务代码，sys 高查系统调用与锁，si 高查网络"
    public: false
    order: 4
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: 'top(1)'
  - id: kp-lc1-5
    text: "第 5 步 佐证：perf top 看热点函数，pidstat 看波动是否持续"
    public: false
    order: 5
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: 'top(1)'
---

标准链路五步（**先看构成再钻进程**）：

```
①top            → 锁定进程；看 CPU 构成
   us 高=业务代码在烧；sys 高=内核忙（系统调用/切换/锁）；si 高=软中断（网络收包）
②top -H -p PID  → 进程内线程排行，记下最热的线程 TID
③printf '%x' TID → 十六进制；Java: jstack PID | grep -A 20 nid=0x...（直指代码行）
   C/C++: perf top -p / gdb attach 看栈
④分诊：
   us 高 → 死循环/正则回溯/频繁 GC（jstat 看GC）/序列化
   sys 高 → strace -c 数调用（高频小 IO？）/ vmstat cs 看切换（锁竞争？）
   si 高 → 网卡流量（sar -n DEV）/ RSS 分散（ethtool -l）
⑤佐证：perf top 热点函数、pidstat -t 1 看是否持续或抖动
```

**为什么钻到线程**：CPU 的调度单位是线程——进程 100% 可能是 400 线程各出 25%，**线程视角才能指向具体代码路径**。**us vs sys 的分诊价值**：同是 100%，us=你的代码有问题（循环/算法/GC），sys=用法有问题（疯狂系统调用/锁切换/页错误）——**修的方向完全不同**。

**术语速查**：us/sys/si=CPU 的体检三分|线程视角=指向代码的准星|分诊=先构成后细节

<!--advanced-->
perf record/report 的火焰图（on-CPU 火苗）。off-CPU 分析（候锁/候 IO 的黑洞——pidstat 看不到的另一半）。容器里的 top 假象（/proc 是宿主视角——cadvisor 换算）。
