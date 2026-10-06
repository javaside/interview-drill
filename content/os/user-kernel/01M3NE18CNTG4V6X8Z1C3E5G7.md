---
id: 01M3NE18CNTG4V6X8Z1C3E5G7
blockId: os/user-kernel
relatedBlocks: []
question: 内核旁路（DPDK/io_uring）解决什么问题？
cardType: enumeration
appliesTo: Linux
frequency: mid
followUps:
  - 轮询不是更浪费 CPU 吗？
  - 为什么数据库对 io_uring 越来越积极？
keyPoints:
  - id: kp-uk5-1
    text: 内核网络栈路径长：中断+软中断+协议栈+拷贝+唤醒——微秒级
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk5-2
    text: DPDK：网卡直通用户态轮询收包——免中断免拷贝免切换
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk5-3
    text: io_uring：提交/完成双环共享内存——批量系统调用合并
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk5-4
    text: 代价：独占 CPU 轮询、绕过内核安全与调试设施
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
  - id: kp-uk5-5
    text: 适用：超高包量网关/存储引擎；常规业务收益配不上复杂度
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: Intro
---

内核是**通用公平**的设计，代价是**路径长**：一个包进来——硬中断→软中断协议栈→socket 缓冲→唤醒进程（切换）→拷贝到用户态。每步几十微秒不显眼，**百万 PPS 的时候全是税**。

**旁路的两种流派**：

- **DPDK（网络旁路）**：网卡**直接 DMA 进用户态内存**，应用**轮询**收包队列——跳过中断、协议栈、内核缓冲、唤醒切换（把「事件驱动的省」换成「轮询的快」——用独占的核换**微秒级稳定延迟**；金融网关/电信转发在用）；
- **io_uring（系统调用旁路）**：用户态与内核共享**两块环**（提交环+完成环）——攒 100 个 IO 请求**一次进内核全办完**，完成结果也是环里异步取——把「一万次过门」折成「一次」+真异步（数据库/高性能存储的新宠）。

**代价清单**：DPDK 独占 CPU（核不能分心）、自己实现协议栈（内核的 TCP 拥塞控制/TLS 全自己扛）、绕过 iptables/监控（安全与运维设施瞎掉）；io_uring 复杂度落在应用侧（生命周期/错误处理）。

**判断句**：**包量/IO 量到了内核税占比显著**（网关百万 PPS、存储引擎刷盘）才值得；普通 Web 服务，内核态的通用性与生态远比旁路的微秒值钱。

**术语速查**：内核税=通用性的价格|轮询换中断=拿 CPU 买延迟|双环=提交与完成的黑话

<!--advanced-->
XDP/eBPF（包还在内核就处理——旁路与安全的折中）。SPDK（存储旁路全家桶——NVMe 用户态驱动）。RDMA（网卡互写内存——HPC/分布式存储的底牌）。
