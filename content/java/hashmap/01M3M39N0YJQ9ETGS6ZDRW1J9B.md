---
id: 01M3M39N0YJQ9ETGS6ZDRW1J9B
blockId: java/hashmap
relatedBlocks:
  - java/collections-overview
question: HashMap key 放进桶后再改参与 hash 的字段，get 还会找到它吗？
cardType: judgment
conclusion: 'no'
appliesTo: Java 17+
frequency: high
followUps:
  - value 可变有问题吗？
keyPoints:
  - id: kp-hm5-1
    text: 入桶后修改参与 hash 的字段：hash 变了，元素留在旧桶——之后查不到
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XKDQWCFQA90XVF04A
      - 01M3M39N0YA1HP86YF1S7YW43K
      - 01M3M39N0YWCHF3XP50BM5S57W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-hm5-2
    text: get/remove 都按新 hash 找新桶，旧桶里的它成了孤儿（内存泄漏式滞留）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0XKDQWCFQA90XVF04A
      - 01M3M39N0YA1HP86YF1S7YW43K
      - 01M3M39N0YWCHF3XP50BM5S57W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-hm5-3
    text: 规范：key 用 String/Integer 或含 final 字段的不可变对象
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0YA1HP86YF1S7YW43K
      - 01M3M39N0YWCHF3XP50BM5S57W
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

Map 定位元素靠的是 **key 的 hash**。放进去之后再**改 key 的字段**（参与 hashCode 的字段）：

- 它的 hash 变了，但**人还留在按旧 hash 算出的桶里**；
- `get(key)` 按新 hash 去新桶找 → **找不到**；`remove` 同样删不掉；
- 它成了**孤儿**：占着桶、永远访问不到（除非哪天 key 又改回去）。

结论：**key 必须不可变**（String、Integer 天然合格；自定义对象把参与 equals/hashCode 的字段设 final）。value 随便变，不影响定位。

**术语速查**：孤儿=桶里在、逻辑上找不到的条目｜不可变 key=hash 终身不变

<!--advanced-->
这本质是「hash 不变量契约」被破坏。transient 弱引用（WeakHashMap）解决的是 key 被回收的场景，与此不同。遍历期间碰巧按旧 hash 命中旧桶可读到——行为不可依赖。修复只能全量重放（遍历 re-insert）。
