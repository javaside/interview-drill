---
id: 01M3MFN29SXPHFZNSN8AFVT4BQ
blockId: spring/security-basics
relatedBlocks: []
question: 密码为什么要用 BCrypt 存？
cardType: enumeration
appliesTo: Spring 6+
frequency: high
followUps:
  - BCrypt 怎么校验（盐不存怎么对得上）？
keyPoints:
  - id: kp-sec4-1
    text: 自带随机盐：同密码每次哈希结果不同——彩虹表报废
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec4-2
    text: 慢哈希（可调 cost）：暴力破解成本被拉高几个数量级
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec4-3
    text: 盐内嵌于输出——存储无需单独盐字段
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core
  - id: kp-sec4-4
    text: MD5/SHA 系列：快=易被 GPU 撞库，且无盐同码同文
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: core

misconceptions:
  - id: mc-sec4-1
    text: 用 BCrypt 要单独建盐字段，注册时生成盐存一列，哈希结果存另一列
    why: 误解：BCrypt 把盐内嵌进输出串（$2a$10$ 后那段），一张表一列就够，校验时从串里抠出盐重算再比对
  - id: mc-sec4-2
    text: 盐属于敏感信息必须保密，一旦泄露拖库者就能反查全部密码
    why: 误解：盐本来就随哈希串明文存放，它的作用只是让同密码各次结果不同；拖库后真正挡住暴力破解的是 cost 拉高的算力开销
  - id: mc-sec4-3
    text: BCrypt 是可逆加密，后台拿着密钥就能把库里的密文还原成明文
    why: 误解：BCrypt 是单向哈希，没有密钥也没有解密这回事；找回密码只能重置，校验是把输入用同一盐重算一遍再比对
---

密码存储三宗罪：**明文**（拖库即裸奔）、**MD5**（快哈希——GPU 每秒千亿次撞库；无盐时「同密码同密文」还能彩虹表批量反查）、**固定盐**（盐泄露同前）。

**BCrypt 的三重门**：

1. **随机盐**内嵌在输出里（`$2a$10$盐22位+哈希31位`）——同密码**每次结果不同**，彩虹表彻底失效；
2. **慢**（cost 因子可调，默认 2^10 轮）——每次哈希几十毫秒，正常登录无感、暴力破解成本天文数字；
3. **校验时取盐**：把存的串里的盐抠出来、用同一盐再哈希一遍你的输入——比对两次结果。

**术语速查**：盐=每次随机的调味料｜cost=哈希轮数（暴力成本旋钮）｜慢哈希=防撞库的核心

<!--advanced-->
DelegatingPasswordEncoder 的 {bcrypt} 前缀多算法共存与升级（encode 升级旧格式）。Argon2id 是更强继任（抗 GPU/ASIC 的内存硬度）。密码策略与登录限流/锁定配套。
