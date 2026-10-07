---
id: 01M3NE18CNS7F9H1J3M5N7R9T2W
blockId: os/memory-mgmt
relatedBlocks: []
question: 虚拟内存是什么？页表怎么工作？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 为什么不是连续分配？
  - TLB 和 CPU 缓存是一回事吗？
keyPoints:
  - id: kp-mm1-1
    text: 每进程一套虚拟地址空间，隔离互踩——物理内存统一由内核调度
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS2A4C6E8G0K2M4N6Q
      - 01M3NE18CNT1M4N6Q8S1V3X5Z7B
      - 01M3NE18CNTF2T4V6X8Z1C3E5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: mm concepts
  - id: kp-mm1-2
    text: 页=分配最小单位（4KB）；页表把虚拟页号翻译成物理帧号
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNT1M4N6Q8S1V3X5Z7B
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: mm concepts
  - id: kp-mm1-3
    text: 多级页表省空间：只用到的区域才建下层页表
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: mm concepts
  - id: kp-mm1-4
    text: TLB 缓存翻译结果——命中免查表，失效是切进程的大头
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS2A4C6E8G0K2M4N6Q
      - 01M3NE18CNTF2T4V6X8Z1C3E5
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: mm concepts
  - id: kp-mm1-5
    text: 换页：物理不够时把冷页写 swap，腾给热页
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS8G0K2M4N6Q8S1V3X
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/admin-guide/mm/concepts.html
      locator: mm concepts
---

**虚拟内存**是操作系统最大的魔术之一：每个进程都以为自己独占一整条连续内存（如 48 位地址空间），实际物理内存由内核**按页拆借**：

```
虚拟地址（进程视角，连续）      页表           物理内存（实际，散装）
0x7f30_0000 ────────────▶ 页表项 ──▶ 帧 #581
0x7f30_1000 ────────────▶ 页表项 ──▶ 帧 #203   （物理上不连续没关系）
0x7f30_2000 ────────────▶ 未映射（访问即缺页/段错误）
```

**四大收益**：①**隔离**（地址空间私有——野指针最多崩自己）；②**按需分配**（`malloc` 只记账不占物理，摸到才给）；③**超售**（物理 8G 能跑「合计 20G」的进程——冷页换出到 swap）；④**共享**（同个 libc 物理页映射进所有进程，省内存）。

**翻译机制**：虚拟页号→物理帧号靠**页表**；**多级页表**（x86-64 四级）只为省空间——没映射的区段根本不建下层表；**TLB** 是页表翻译的 CPU 缓存——**命中免查**（查表要 4 次内存访问，代价巨大），这就是**进程切换比线程切换贵**的隐形原因（换页表=刷 TLB）。

**术语速查**：虚拟连续物理散装=魔术的本质|缺页=摸到才给|TLB 失效=切进程的税

<!--advanced-->
大页 HugePage（2MB/1GB——减少页表项与 TLB miss，数据库/堆大户的标配）。NUMA（多 socket 的内存本地性——绑核绑内存）。页表项的权限位（RWX——越权访问的 SIGSEGV 来源）。
