---
id: 01M3M7HTMBQZ1TPKXGJKA9GZK8
blockId: jvm/gc-collectors
relatedBlocks:
  []
question: "什么是卡表和写屏障？"
cardType: atomic
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么跨代引用要单独记？
keyPoints:
  - id: kp-gc6-1
    text: "卡表：老年代切成 512B 的卡，指向新生代的卡标脏——Minor 只扫脏卡"
    public: true
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: 'JVMS'
---

**问题**：Minor GC 只扫新生代，但**老年代对象可能引用新生代**——总不能每次 Minor 翻整个老年代？

**卡表（Card Table）**：老年代切成一张张 **512 字节的卡**，配一个字节数组。**写屏障**在「老年代对象写字段指向新生代」时把那张卡标**脏**。Minor GC 时：只扫**脏卡**对应的老年代区块找 roots——从「扫整个老年代」缩到「扫几张脏卡」。

**术语速查**：卡表=老年代的脏卡登记簿｜写屏障=引用写入时的检查哨｜脏=这张卡里有跨代引用

<!--advanced-->
byte 数组 CARD_DIRTY=1；GC 后重置。G1 的 RSet（每 Region 一张卡索引）层级更细但内存代价大（可达堆 1-10%）。写屏障的另一职责：三色标记的增量更新/SATB。伪共享的卡表行（UseCondCardMark）。
