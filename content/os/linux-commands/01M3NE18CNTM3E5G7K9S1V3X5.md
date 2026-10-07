---
id: 01M3NE18CNTM3E5G7K9S1V3X5
blockId: os/linux-commands
relatedBlocks: []
question: 网络不通/变慢，排查命令怎么组织？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - CLOSE_WAIT 堆积说明什么？
  - 为什么建议先 ss 后 tcpdump？
keyPoints:
  - id: kp-lc4-1
    text: 分层思路：先通断（ping/telnet）再链路（traceroute）再本端（ss/listen）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: ss(8)
  - id: kp-lc4-2
    text: ss -tnlp 看监听与连接状态——TIME_WAIT/CLOSE_WAIT 堆积各指一种病
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNRC9P1R3T5V7X9
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: ss(8)
  - id: kp-lc4-3
    text: tcpdump 抓包看事实：重传/RST/半握手——证据之王
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: ss(8)
  - id: kp-lc4-4
    text: curl -w 计时分解：dns/connect/tls/首字节——慢在哪一段
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: ss(8)
  - id: kp-lc4-5
    text: 连通但慢 vs 不通：不通查路由防火墙，慢查重传与队列
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man1/top.1.html
      locator: ss(8)
---

按**成本从低到高**逐层逼近：

```
①通断层：ping（ICMP 通吗）→ telnet/nc -zv host port（TCP 能连吗）
        ——不通先查路由 traceroute、安全组/防火墙
②本端层：ss -tnlp（端口在听吗？谁的连接？）
        连接状态分布是金矿：
        TIME_WAIT 多 → 自方高频短连接主动断
        CLOSE_WAIT 多 → 对方关了我没 close——代码 bug（泄漏）
        SYN_SENT 多 → 对端不回 SYN（服务没起/被墙）
③证据层：tcpdump -i any host X port Y -w /tmp/a.pcap
        重传风暴（丢包）、RST（谁拒收）、握手卡半程——白纸黑字
④计时层：curl -o /dev/null -s -w 'dns=%{time_namelookup} conn=%{time_connect}
        tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}
' URL
        ——慢在哪一段一目了然
```

**先 ss 后 tcpdump 的道理**：ss 零成本看状态分布（往往一瞥定位——CLOSE_WAIT 一万=应用没关连接），tcpdump 贵（抓包量大要分析）——**便宜的先问，昂贵的取证**。**CLOSE_WAIT 的语义**：**对方发了 FIN、我方收到了**，但我方应用没调 close——被动方积压全是**自己的泄漏**（忘了关连接/线程卡死没走到 close）。

**术语速查**：先通断后本端再取证|CLOSE_WAIT=自己不关门的证据|-w 计时四段=慢的坐标

<!--advanced-->
 mtr（ping+traceroute 实时合一）。conntrack 表满（nf_conntrack: table full——NAT 环境高并发经典）。sar -n DEV,TCP,ETCP 的历史回放（出事时不在场也能回看）。
