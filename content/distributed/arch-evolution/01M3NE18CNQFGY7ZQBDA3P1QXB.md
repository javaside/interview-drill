---
id: 01M3NE18CNQFGY7ZQBDA3P1QXB
blockId: distributed/arch-evolution
relatedBlocks: []
question: 怎么设计一个短链系统？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 301 和 302 选哪个？
keyPoints:
  - id: kp-ae5-1
    text: 发号器：长链→全局唯一短码（自增转 62 进制/哈希+冲突检测）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae5-2
    text: 存储：短码→长链映射（KV 场景 Redis/MySQL 均可）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae5-3
    text: 跳转：301/302 重定向（302 可统计点击）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ae5-4
    text: 缓存：热点短码进缓存+布隆防穿透
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMV6N4KQQ9A7KDZ3BR
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**短链系统三件套**：

1. **发号**（长链→短码）：①**号段/自增 id 转 62 进制**（0-9a-zA-ZZ——短且有序，可预估容量 7 位=62⁷≈3.5 万亿）；②**哈希**（MurmurHash 取前几位+**冲突探测**（查库撞了加盐重试）；
2. **存储**：短码→长链（MySQL 即可——量大了分片；QPS 高加 Redis 缓存热点，**布隆**拦不存在短码的穿透）；
3. **跳转**：**301**（永久——浏览器缓存，省服务器但**统计不了点击**）vs **302**（临时——每次回源，**可埋点统计**）——营销场景选 302，纯缩短选 301。

**术语速查**：发号器=短码的出生地｜62 进制=用满字母数字的短码制式｜302=可统计的重定向

<!--advanced-->
短码长度的容量数学（62^k）。跳转链路的极限优化（边缘缓存/DNS 级）。自定义短码（语义后缀）与品牌域名的映射表。防滥用（黑名单/敏感链扫描）。
