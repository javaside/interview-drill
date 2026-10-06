---
id: 01M3M7HTMBSTC29P00FXB19R8F
blockId: jvm/object-engine
relatedBlocks:
  - jvm/gc-basics
question: 对象访问定位有哪两种方式？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - HotSolar 为什么选直接指针？
keyPoints:
  - id: kp-oe4-1
    text: 句柄访问：引用指向句柄池，句柄存对象与类数据地址——移动对象只改句柄
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe4-2
    text: 直接指针访问：引用直接存对象地址——HotSpot 采用，访问快一步
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe4-3
    text: 句柄的代价：多一次寻址；收益：GC 搬家不用改所有引用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
  - id: kp-oe4-4
    text: 直接指针的代价：GC 移动对象要改全部引用（记忆集/根扫描定位）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html
      locator: JVMS
---

引用（reference）怎么找到对象？两种**门牌方案**：

- **句柄访问**：引用存**句柄池**的地址，句柄里写「对象在哪、类在哪」。GC 搬家时**只改句柄**里的地址，所有引用纹丝不动——**搬家便宜**；
- **直接指针**：引用**直接存对象地址**（HotSpot 的选择）——**访问少一次寻址**，快；代价是 GC 移动对象时要把**引用它的指针全部改一遍**（roots/卡表能定位到，成本可承受）。

**术语速查**：句柄=对象地址的中转牌｜直接指针=一步到位｜搬家成本=改谁指向它

<!--advanced-->
HotSpot 的 oop（ordinary object pointer）即直接指针形态；压缩指针下 oop 是 32 位偏移（管 32GB）。句柄派代表：早期 IBM J9。GC 移动的改引用由 roots 枚举+卡表/RSet 收敛范围。
