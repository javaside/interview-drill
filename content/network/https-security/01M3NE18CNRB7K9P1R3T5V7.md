---
id: 01M3NE18CNRB7K9P1R3T5V7
blockId: network/https-security
relatedBlocks:
  []
question: "TLS 1.3 相比 1.2 快在哪、强在哪？"
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 0-RTT 的代价是什么？
  - 为什么删掉 RSA 交换？
keyPoints:
  - id: kp-hs5-1
    text: "握手 2-RTT → 1-RTT：ClientHello 直接带密钥交换参数"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc8446.html
      locator: 'RFC 8446'
  - id: kp-hs5-2
    text: "0-RTT 恢复：带早期数据重连续传，首请求即带业务数据"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc8446.html
      locator: 'RFC 8446'
  - id: kp-hs5-3
    text: "强制前向安全：删 RSA 静态交换，只留 ECDHE 家族"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc8446.html
      locator: 'RFC 8446'
  - id: kp-hs5-4
    text: "套件砍到 5 个：全 AEAD 加密，废 RC4/CBC 弱算法"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc8446.html
      locator: 'RFC 8446'
  - id: kp-hs5-5
    text: "握手消息加密更多：证书也在密文里，被动抓包看不到对方是谁"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc8446.html
      locator: 'RFC 8446'
---

TLS 1.3（2018）= **1.2 的安全补丁 + 速度翻新**：

- **快**：握手从 2-RTT 压到 **1-RTT**（ClientHello 直接带上 ECDHE 公钥——不再来回等套件确认）；**会话恢复 0-RTT**——重连时第一个包就捎业务数据（移动端弱网收益巨大，代价见下）；
- **强**：**只留前向安全的 ECDHE**（删 RSA 静态交换——服务器私钥将来泄露，历史流量依然安全）；密码套件**砍到 5 个**全 AEAD（废 RC4/CBC/3DES——选择少了，选错的机会也少了）；握手**后半程全加密**（连证书都藏在密文里，被动监听者连「你访问了谁」都难知道）。

**0-RTT 的代价是重放**：早期数据没有新鲜性保证，攻击者原样重发——服务端会重复执行。规矩：**0-RTT 只放幂等请求**（GET），下单/转账必须落在握手完成之后。

**术语速查**：1-RTT=来一回即握手|0-RTT=首个包带货|前向安全=私钥沦陷历史不裸奔

<!--advanced-->
Downgrade protection（Finished 里嵌入协商历史防降级）。会话票据 PSK 与 resumption master secret。QUIC 直接内建 TLS 1.3（加密握手的传输层——连包号都加密防流量分析）。
