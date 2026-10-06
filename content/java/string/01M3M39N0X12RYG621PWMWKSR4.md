---
id: 01M3M39N0X12RYG621PWMWKSR4
blockId: java/string
relatedBlocks: []
question: String 的 hashCode 是怎么算的？
cardType: atomic
appliesTo: Java 17+
frequency: mid
followUps:
  - 为什么选 31 这个系数？
keyPoints:
  - id: kp-st4-1
    text: s[0]*31^(n-1) + s[1]*31^(n-2) + … + s[n-1]：按位乘 31 累加，结果缓存
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

公式：**h = 0; 对每个字符 c：h = 31*h + c**——即 `s[0]*31^(n-1) + s[1]*31^(n-2) + …`。

两个要点：①**首字符权重最大**（31 的幂次），所以 "Aa" 和 "BB" 这种巧值会撞出相同 hash；②算好的结果**缓存在 hash 字段**——String 不可变，hash 一辈子算一次就够（HashMap 的 key 高频取 hash，这省了大量重复计算）。

系数 31：奇素数、乘法可被 JIT 优化成移位减法（31*i = (i<<5)-i）、碰撞分布尚可——历史选择，不是唯一解。

**术语速查**：多项式哈希=逐字符乘系数累加｜hash 缓存=不可变才敢缓存

<!--advanced-->
31 溢出取模 2^32 自然回绕。缓存字段的延迟计算发生在首次 hashCode() 调用。String hash 的可预测性曾是 HashDoS 攻击面（构造大量同 hash 串），HashMap 已用扰动函数缓解（见 hashmap 块）。
