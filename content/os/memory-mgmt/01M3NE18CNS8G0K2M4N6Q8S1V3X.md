---
id: 01M3NE18CNS8G0K2M4N6Q8S1V3X
blockId: os/memory-mgmt
relatedBlocks:
  []
question: "缺页中断和页面置换算法？"
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - fork 后写共享页会发生什么？
  - 怎么判断系统在颠簸？
keyPoints:
  - id: kp-mm2-1
    text: "缺页：访问的页不在内存——触发中断由内核补页（读盘/分配/换入）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mm concepts'
  - id: kp-mm2-2
    text: "类型：良性（按需调入）/ 换入（从 swap 回来）/ 恶性（越权→段错误）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mm concepts'
  - id: kp-mm2-3
    text: "物理满则置换：挑冷页让位——LRU 家族是主流"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mm concepts'
  - id: kp-mm2-4
    text: "LRU 精确代换太贵：active/inactive 双链表近似"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mm concepts'
  - id: kp-mm2-5
    text: "颠簸：工作集超物理容量——页频繁进出，CPU 全耗在换页上"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: 'mm concepts'
---

**缺页中断**（page fault）不是坏事——它是「按需分配」的兑现时刻：进程摸到一个还没映射的虚拟页 → CPU 陷入内核 → 内核看这地方**该不该有数据**：

- **良性缺页**：malloc 过但没摸过的页——直接给一帧清零页，零磁盘 IO（「惰性分配」的红利）；
- **换入缺页**：页被换出到 swap——从盘读回（**贵**——毫秒级，性能杀手）；
- **恶性缺页**：地址根本没登记（越界/越权）——**SIGSEGV 段错误**，进程领便当。

**物理满了换谁走**：理想是 **LRU**（最久没用的），但链表维护太贵——内核用 **active/inactive 双链表近似**（新页进 inactive，被二次访问升 active；换出从 inactive 尾部挑）。**fork 的巧妙应用——写时复制（COW）**：fork 后父子先共享同批物理页（只读），**谁写谁缺页**——内核此时才复制那一页（「缺页」当挂钩实现惰性复制）。

**颠簸（thrashing）**：工作集 > 物理内存——刚换出的马上又要用，`majflt`（主缺页）飙升、CPU 大半候磁盘。诊断：`sar -B` 看 majflt/s；根治：**加内存或砍进程**，别指望调参。

**术语速查**：缺页=惰性分配的兑现时刻|COW=缺页实现的复制拖延术|主缺页=真去了磁盘

<!--advanced-->
Oracle/PG 的 hugepages 与页表膨胀（每进程一份页表×进程数）。swapiness 的调与不调（SSD 时代低值优先）。NUMA 亲和与远端内存的隐形延迟。
