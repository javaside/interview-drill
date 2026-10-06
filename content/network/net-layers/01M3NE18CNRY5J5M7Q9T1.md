---
id: 01M3NE18CNRY5J5M7Q9T1
blockId: network/net-layers
relatedBlocks: []
question: 交换机、路由器、LB 分别工作在哪一层？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - L4 和 L7 负载均衡怎么选？
  - 网关和 LB 是一回事吗？
keyPoints:
  - id: kp-nl3-1
    text: 交换机：链路层——按 MAC 地址表转发帧（局域网内）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl3-2
    text: 路由器：网络层——按路由表 IP 转发包（跨网段/自治域）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl3-3
    text: 四层 LB：改包转发（IP+端口）——LVS/DPVS
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl3-4
    text: 七层 LB：解析应用协议按内容分发——Nginx/Envoy（反向代理）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
  - id: kp-nl3-5
    text: 设备演进趋势：功能软件化（SDN/智能网卡），边界日益模糊
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc1122.html
      locator: RFC 1122
---

**「在哪层读数据，就在哪层干活」**：

| 设备 | 层 | 看什么转发 | 职责 |
|---|---|---|---|
| 交换机 | L2 链路 | **MAC 地址表**（学习源 MAC） | 同一局域网内帧转发、VLAN 划分 |
| 路由器 | L3 网络 | **路由表**（最长前缀匹配） | 跨网段/IP 寻址、NAT、网关 |
| 四层 LB | L4 传输 | **IP+端口**（报文头） | 连接级分发——LVS DR/NAT 模式，性能极高（不碰应用数据） |
| 七层 LB | L7 应用 | **HTTP 路径/头/cookie** | 反向代理——Nginx/Envoy：路由、改写、限流、TLS 卸载、缓存 |

**L4 vs L7 的取舍**：L4 只看四元组转发——**吞吐百万级 QPS、延迟微秒级**，但看不见 URL（没法按路径分流、没法改头部）；L7 解析应用协议——**按内容调度**（/api 去后端、/static 去缓存）、能做治理（限流/熔断/灰度），代价是每条连接要终结 TLS+解析 HTTP（CPU 重）。工业常态：**LVS（L4）扛流量 → Nginx/Envoy（L7）做治理** 两级串联。

**术语速查**：MAC 表=二层通讯录|最长前缀匹配=选最具体的路|反向代理=代表服务端接客

<!--advanced-->
LVS 三模式（NAT/DR/TUN——DR 改 MAC 不改 IP，回包直走）。SDN 与可编程数据面（P4）。服务网格把 L7 治理下沉 sidecar（Envoy 双人舞——LB 之外的新形态）。
