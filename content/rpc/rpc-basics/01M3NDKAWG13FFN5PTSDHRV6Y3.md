---
id: 01M3NDKAWG13FFN5PTSDHRV6Y3
blockId: rpc/rpc-basics
relatedBlocks: []
question: 序列化协议怎么选？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: high
followUps:
  - 为什么内部服务推荐 Protobuf？
keyPoints:
  - id: kp-rb2-1
    text: JSON：可读、跨语言、体积大——调试友好的人类格式
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb2-2
    text: Protobuf：二进制强类型，schema 先行——体积最小速度最快
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb2-3
    text: Hessian2：Dubbo 默认，二进制自描述，跨语言一般
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb2-4
    text: Kryo：Java 系最快，跨语言差（不推荐长期存储）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb2-5
    text: 选型维度：体积/速度/跨语言/可读性/演进兼容
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-rb2-7
    text: JSON 的字段名冗余在压缩后差距缩小
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**序列化=对象怎么变成线上字节**。四个维度的排序题：

- **JSON**：人类可读（调试爽）、跨语言无敌——但文本冗余（字段名每条都带）、解析慢——**对外 API/低频管理面**的默认；
- **Protobuf**：**强类型 + 二进制**——字段编号代替名字（体积小 3-5 倍）、schema 编译期校验、向后兼容规则明确（增字段安全）——**内部高性能通信**首选（gRPC 的底座）；
- **Hessian2**：Dubbo 传统默认——自描述二进制，Java 生态顺，跨语言弱于 PB；
- **Kryo**：Java 内最快，但**版本兼容坑多**——缓存/临时传输可用，持久化慎。

**术语速查**：字段编号=用 1,2,3 代替字段名｜schema 先行=先定义结构再传数据｜向后兼容=加字段旧端不崩

<!--advanced-->
Protobuf 的 varint/zigzag 编码与 tag-length-value 结构。兼容规则：改编号=断代（等同新字段）、reserved 防误用。跨语言场景 JSON/PB 之外（Thrift/Avro 的 idl 差异）。
