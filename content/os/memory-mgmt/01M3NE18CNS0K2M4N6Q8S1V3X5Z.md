---
id: 01M3NE18CNS0K2M4N6Q8S1V3X5Z
blockId: os/memory-mgmt
relatedBlocks: []
question: OOM 是怎么发生的？内存泄漏怎么排查？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 容器 OOMKilled 和虚拟机 OOM 一样吗？
  - RSS 和 VSZ 看哪个？
keyPoints:
  - id: kp-mm4-1
    text: OOM：物理+swap 都不够，内核挑「最贵」进程杀掉解围
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: oom(7)
  - id: kp-mm4-2
    text: OOM killer 评分：RSS 越大越先死（oom_score）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: oom(7)
  - id: kp-mm4-3
    text: 泄漏形态：堆内存没 free/连接 fd 没关/缓存无上限只进不出
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: oom(7)
  - id: kp-mm4-4
    text: 排查链：free→top 排序→进程内工具（jmap/heap profile）定位分配点
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: oom(7)
  - id: kp-mm4-5
    text: 防线：容器配 memory limit+告警；缓存设上限与过期
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: oom(7)
---

**OOM**（Out Of Memory）是内核的**弃车保帅**：物理内存+swap 全线告急 → 触发 OOM killer → 按 **oom_score**（≈RSS 越大分越高）挑一个「最肥」的进程 SIGKILL。**容器里更常见**：cgroup 内存超 limit → **OOMKilled**（exit code 137）——只看本容器账本，整机内存再空也没用（Java 容器事故的头号来源：JVM 没感知 cgroup limit，堆+元空间+堆外超限被杀）。

**泄漏三形态**（不只是「忘了 free」）：①**堆内存**（对象被静态集合永久持有——Java 最常见）；②**fd/连接**（没 close——`lsof` 数量爬升）；③**缓存无界**（本地缓存只进不出——「功能正常的泄漏」）。

**排查链**：

```
free -h（确认整机水位）→ top 按 RES 排序（谁在涨）
→ Java：jmap -histo / 堆 dump 对比（MAT 看支配树）
→ Native：valgrind / tcmalloc profiler / pmap 看匿名段
→ fd 泄漏：ls /proc/<pid>/fd | wc -l
```

**看 RSS 不看 VSZ**：VSZ 是虚拟地址空间（预登记，大而虚），RSS 才是**真占的物理内存**。

**术语速查**：oom_score=谁肥谁先死|137=cgroup 授衔的 SIGKILL|只进不出=缓存型泄漏

<!--advanced-->
JVM MaxRAMPercentage 与容器感知（-XX:+UseContainerSupport）。glibc arena 泄漏（多线程容器 RSS 怪涨——MALLOC_ARENA_MAX=2 的偏方）。MADV_FREE 与 RSS 回报延迟（free 不掉的另一种假象）。
