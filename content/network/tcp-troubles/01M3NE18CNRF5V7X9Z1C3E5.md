---
id: 01M3NE18CNRF5V7X9Z1C3E5
blockId: network/tcp-troubles
relatedBlocks: []
question: 什么情况下会收到 RST？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - Connection reset by peer 在排查什么方向？
  - RST 与 FIN 的体验差别？
keyPoints:
  - id: kp-tt4-1
    text: 端口未监听/半开：SYK 打到无人端口立即回 RST
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt4-2
    text: 请求打到不存在的连接：四元组对不上（对端已重启/清表）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt4-3
    text: 进程崩溃：内核替进程关 socket 发 FIN/RST，缓冲数据丢弃
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt4-4
    text: 主动弃数据关闭：SO_LINGER 超时 0 或应用 abort——不走正常挥手
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
  - id: kp-tt4-5
    text: 防火墙/中间盒注入 RST 拦断（GFW/安全策略的经典手法）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: RFC 9293
---

RST（复位）是 TCP 的**急刹车**：不走挥手、不发剩余数据、双方立刻散场。常见五个来源：

1. **打到无人端口**（服务没起/端口写错）——SYN 直接被 RST（`Connection refused`——注意这与超时不同：**有 RST 说明网络通、没人接**；超时说明包根本到不了）；
2. **四元组对不上**（对端机器重启过、NAT 表项过期换了映射）——你的包落在它眼里是「不存在的连接」，回 RST；
3. **进程崩溃**——内核代为清理 socket；进程被 OOM kill 后常见 `reset by peer`；
4. **应用主动弃数据**——`SO_LINGER` l_onoff=1 且 timeout=0 的 close、或 LB 主动断后端连接（为省 TIME_WAIT 直接 RST——客户端看到 reset）；
5. **中间盒拦截**——防火墙策略/GFW 对命中规则的流注入 RST 两端各断。

**排查方向**：refused → 查服务起没起、端口对不对；reset mid-stream → 查对端日志（崩溃/OOM）、中间有没有 LB 在主动断；配合 `ss -tnp` 看本端连接状态。

**术语速查**：RST=急刹车不告别|refused≠timeout（有人拒收 vs 无人应门）|弃数据关=linger 0

<!--advanced-->
SO_LINGER 的三档语义（默认后台发完/阻塞候发/超时 0 立即 RST）。RST 后再写会触发 SIGPIPE（C 语言经典崩点——需 ignore 或 MSG_NOSIGNAL）。防火墙 RST 的 TTL 指纹识别法。
