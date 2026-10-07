---
id: 01M3NE18CNTJ8Z1C3E5G7K9S1
blockId: os/linux-commands
relatedBlocks: []
question: free 的输出怎么读？available 和 free 有什么区别？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 为什么 Linux 总显得内存快用完？
  - swap 用了一定是坏事吗？
keyPoints:
  - id: kp-lc2-1
    text: free 列=完全空闲；available=还能给应用的量（含可回收缓存）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS0K2M4N6Q8S1V3X5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: free(1)
  - id: kp-lc2-2
    text: buff/cache 不是被偷走——是内核拿闲内存做缓存，可即时让渡
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS0K2M4N6Q8S1V3X5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: free(1)
  - id: kp-lc2-3
    text: 判断内存压力看 available 与 swap 是否增长，不是看 free
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS0K2M4N6Q8S1V3X5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: free(1)
  - id: kp-lc2-4
    text: sar -r 看趋势，ps aux --sort=-rss 找大户
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS0K2M4N6Q8S1V3X5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: free(1)
  - id: kp-lc2-5
    text: 交换两信号：si/so 持续非零=真缺内存；偶发换出是正常调剂
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNS0K2M4N6Q8S1V3X5Z
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: free(1)
---

```
$ free -h
              total   used   free      buff/cache   available
Mem:           15G    6.2G   300M      8.9G         8.5G
```

**核心认知**：Linux 把**闲内存当浪费**——拿去当 buff/cache（页缓存/目录缓存），**应用要的时候立即让渡**。所以「free 只有 300M」不是警报，**available（8.5G）才是「还能给出多少」的诚实答案**（≈free+可快速回收的缓存）。

**判读三条**：①盯 **available**，低于阈值（如 10%）才是真紧；②**swap 的 si/so**（`vmstat 1`/`sar -W`）——**持续非零**=物理真不够、在换页（性能塌方前兆）；**偶发换出几个冷页**是内核的正常收纳（比如长期不动的守护进程冷页）；③找大户：`ps aux --sort=-rss | head`、`top` 按 RES。

**常见误诊**：见到 buff/cache 大就 `echo 3 > drop_caches`「清理内存」——**倒掉缓存只会让随后 IO 变慢**，毫无收益（那是性能测试前求稳态的特殊操作）。

**术语速查**：available=诚实余额|buff/cache=可回收的活期|si/so=换页的进出账

<!--advanced-->
slab（内核对象缓存——dentry/inode 也占大头，slabtop 看）。cgroup 内存账（容器 memory.current 与 page cache 的归属风波）。min_free_kbytes 与 OOM 的缓冲垫。
