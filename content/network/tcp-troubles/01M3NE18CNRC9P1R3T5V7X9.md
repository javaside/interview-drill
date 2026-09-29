---
id: 01M3NE18CNRC9P1R3T5V7X9
blockId: network/tcp-troubles
relatedBlocks:
  []
question: "TIME_WAIT 过多怎么办？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么不要开 tcp_tw_recycle？
  - 服务端出现 TIME_WAIT 说明谁关的？
keyPoints:
  - id: kp-tt1-1
    text: "TIME_WAIT 由主动关闭方滞留 2MSL——设计保护不是 bug"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt1-2
    text: "大量来源：高频短连接（每请求一连）与自身做主动关闭方"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt1-3
    text: "危害：占端口（客户端 6 万上限）与内存，拖新连接建立"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt1-4
    text: "治本：连接池/长连接复用，把短连接变长连接"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt1-5
    text: "治标参数：扩 port range、开 tcp_tw_reuse（需 timestamp）"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
---

TIME_WAIT 本身是**设计者的深谋远虑**（保最后的 ACK 能补发、让旧报文寿终正寝），**不是泄漏**。问题只在**量大**：

**为什么堆积**：每条**主动断开**的连接都要滞留 2MSL（Linux 60 秒）——高频短连接（每请求建一连用完即关、或 LB 主动 RST 后端）每秒数百连接，一分钟内就攒出上万 TIME_WAIT。

**危害清单**：客户端侧**耗尽本地端口**（同四元组没法建新连接——ephemeral 默认约 2.8 万个）；服务端侧占内存与连接表、拖累 accept；极端时 `Cannot assign requested address`。

**治理的优先级**：①**治本是消灭短连接**——HTTP keep-alive/连接池/gRPC 长流，连接复用了 TIME_WAIT 自然归零；②**治标参数**：扩端口段（`ip_local_port_range`）、开 `tcp_tw_reuse`（仅出方向、靠 timestamp 判定旧报文已死——安全）；③**绝对别碰** `tcp_tw_recycle`（NAT 环境下 timestamp 乱序直接误杀正常连接，内核 4.12 已删除）、更别调短 2MSL（阉割掉协议保护）。

**术语速查**：主动关闭方=TIME_WAIT 的归属｜2MSL=滞留时长（Linux 60s）｜reuse≠recycle（前者安全后者已废）

<!--advanced-->
服务端 TIME_WAIT 爆表的排查路径（谁主动 FIN：LB 的 timeout 主动断、应用 close 顺序）。SO_REUSEADDR 只影响监听重绑不消 TIME_WAIT。连接池的 maxLifetime 与 LB idle timeout 的错位（池内连接被 LB 先断产生半开）。
