---
id: 01M3M39N0Y6BQBPXS0GHMEG740
blockId: java/concurrent-hashmap
relatedBlocks:
  []
question: "ConcurrentHashMap 的 key/value 为什么不允许 null？"
cardType: atomic
appliesTo: Java 17+
frequency: high
followUps:
  - HashMap 允许 null key 的原因？
keyPoints:
  - id: kp-ch2-1
    text: "二义性问题：get 返回 null 无法区分「不存在」还是「存了 null」——并发下无法像 HashMap 那样用 containsKey 复核"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
  - id: kp-ch2-2
    text: "HashMap 允许 null 是因为单线程下可用 containsKey 复核语义"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: 'JLS 17'
---

HashMap 里 `get(k)` 返回 null，可以用 `containsKey(k)` 复核「到底是没有还是值是 null」——**单线程**里这两步连起来答案是可靠的。

**并发**容器里这个组合失效了：containsKey 的一瞬间和 get 的一瞬间之间，别的线程可能已经 put/remove——你永远没法确认「null 到底是什么意思」。干脆**禁掉 null**（key/value 都是），从根上消灭二义性。

**术语速查**：二义性=一个 null 两种含义｜复核失效=两步操作之间世界变了

<!--advanced-->
Doug Lea 的原注释：并发 map 中 (m.containsKey(k) ? m.get(k) : absent) 不是原子快照，null 语义不可判定。HashMap 单线程下两步语义稳定（无中间修改者，除单线程自身）。
