---
id: 01M3NE18CNRG7X9Z1C3E5G7
blockId: network/tcp-troubles
relatedBlocks:
  []
question: "生产上哪些 TCP/内核参数值得调？"
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 调参前先看什么？
  - 怎么验证参数生效？
keyPoints:
  - id: kp-tt5-1
    text: "连接队列：somaxconn 与应用 backlog——高并发建连不掉 SYN"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt5-2
    text: "端口与复用：ip_local_port_range 扩段、tcp_tw_reuse 缓解短连接"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt5-3
    text: "缓冲区：tcp_rmem/wmem 自适应上限——高 BDP 长肥管道要放开"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt5-4
    text: "TIME_WAIT 相关只动 reuse 方向，recycle 已废不碰"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
  - id: kp-tt5-5
    text: "拥塞算法：高丢包长 RTT 链路切 BBR 效果立竿见影"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html
      locator: 'ip-sysctl'
---

调参的顺序论：**先测量后调参**（`ss -s` 看连接分布、`netstat -s | grep -i 'overflow\|drop'` 看丢溢出计数——**有症状才动手**），常见四组：

- **连接建立容量**：`net.core.somaxconn`（accept 全连接队列上限，默认 128——高并发 Web 必改 4096+）与应用 listen backlog 取小生效；配合 `tcp_max_syn_backlog`（半连接队列）——溢出现象是建连慢/被拒；
- **端口与 TIME_WAIT**：`ip_local_port_range` 扩到 1024–65535（出向连接多的客户端/代理）；`tcp_tw_reuse=1`（安全复用，需 timestamp——默认开）；
- **缓冲区**：`tcp_rmem/tcp_wmem` 的 max 上限放开（长肥管道 BDP=带宽×RTT 大时，窗口上不去吞吐就卡死——跨地域传输的核心参数）；
- **拥塞算法**：`tcp_congestion_control=bbr`——高丢包率/深缓冲网络（跨洲链路、无线）吞吐常有数倍提升；同机房低 RTT 收益小。

**验证**：`sysctl -a | grep xxx` 看当前值、`ss -tinp` 看单连接的 cwnd/rwnd 实况、压测前后对比 netstat -s 的错误计数。

**术语速查**：somaxconn=accept 队列闸门|BDP=管道容量决定缓冲需求|netstat -s=症状清单

<!--advanced-->
文件描述符三连（ulimit -n、fs.file-max、nofile——连接数的真正天花板往往是 fd 不是端口）。TIME_WAIT 数值监控（node_exportor 的 netstat collector）。C10K→C10M 的路径（epoll/So_REUSEPORT 多核监听分片）。
