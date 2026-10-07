---
id: 01M3NDKAWGPW7ZR3GM4N1XPD0Z
blockId: rpc/grpc-comm
relatedBlocks: []
question: Protobuf 的字段编号规则？
cardType: enumeration
appliesTo: Dubbo 3 / gRPC
frequency: mid
followUps:
  - 改了字段编号会怎样？
keyPoints:
  - id: kp-gr4-1
    text: 编号一旦使用不可改（线上字节流的字段定位全靠它）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGGBQW2ZSY0KFMDHQR
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr4-2
    text: 1-15 单字节编码——高频字段优先用这段
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr4-3
    text: 删除字段要 reserved 编号与名字——防新人复用酿事故
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGGBQW2ZSY0KFMDHQR
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
  - id: kp-gr4-4
    text: 新增字段双方兼容：旧端读新数据忽略未知字段
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NDKAWGGBQW2ZSY0KFMDHQR
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://cn.dubbo.apache.org/zh-cn/docsv2.7/dev/
      locator: doc
---

**Protobuf 的字段在字节流里没有名字——只有编号**（`tag = (field_number << 3) | wire_type`）：

- **编号即身份**：改编号 = 老客户端发的字段 1（姓名）被新服务端当字段 2（年龄）解析——**静默数据错乱**（不报错！最危险的那种）；
- **1-15 最省**：编号 1-15 连类型 tag 一字节编码——**高频/必填字段放这段**；16-2047 两字节；
- **删除必须 reserved**：删掉的字段要把编号（和名字）标 `reserved`——否则后人复用这个编号 = 上面的事故重演；
- **加字段安全**：新增字段老版本自动忽略——前后兼容的正路。

**术语速查**：编号即身份=字节流里的字段地址｜reserved=坟地圈起来防复用｜未知字段忽略=前向兼容机制

<!--advanced-->
wire type（varint/64bit/length-delimited）与 tag 结构。proto3 的默认值不可设（零值语义与 optional 的回归）。unknown fields 的保留转发（中间代理不该丢）。oneof/repeated/packed 的编码差异。
