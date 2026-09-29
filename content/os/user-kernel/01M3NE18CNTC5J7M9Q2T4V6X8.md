---
id: 01M3NE18CNTC5J7M9Q2T4V6X8
blockId: os/user-kernel
relatedBlocks:
  []
question: "为什么要有用户态和内核态的区分？"
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 图书馆的操作系统类比：闭架书库怎么理解？
  - 内核态代码挂了会怎样？
keyPoints:
  - id: kp-uk1-1
    text: "CPU 特权级：Ring0 内核全能 / Ring3 用户受限——硬件级隔离"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: 'Intro'
  - id: kp-uk1-2
    text: "用户态碰不了：裸 IO 端口/页表/中断——设备与内存必须内核统管"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: 'Intro'
  - id: kp-uk1-3
    text: "目的：防失控进程破坏系统——稳定性与安全的底线"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: 'Intro'
  - id: kp-uk1-4
    text: "系统调用=受控的门：用户通过固定入口请内核代办"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: 'Intro'
  - id: kp-uk1-5
    text: "切换有成本：寄存器/栈切换+安全检查——高频调用要节制"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.kernel.org/doc/html/latest/process/1.Intro.html
      locator: 'Intro'
---

**特权级（Ring）是 CPU 硬件给的门禁**：x86 分 Ring0~3，内核住 **Ring0**（全能：改页表、碰设备、收中断），应用住 **Ring3**（Restricted：碰硬件的指令直接 CPU 异常）。这不是软件君子协定——**硬件强制**。

**为什么必须分**：想象任何一个进程都能直接改页表、直接写磁盘——一个野指针就能**踩掉整个系统**，一个恶意程序能冒充任何人。内核态的存在把**危险能力收归国有**：设备、内存分配、调度全由内核代管，应用通过**系统调用**这个「服务窗口」申请（你说要读文件，内核验明正身替你读）。

**类比**：图书馆**闭架书库**——读者（用户态）不能进库乱翻，填单子请管理员（系统调用）代取；管理员按规矩操作（权限检查），书库秩序（系统稳定）不被任何读者破坏。

**代价**：每次进门要「登记」（保存现场/切栈/安全检查）——微秒级。这就是：一次 `read` 比一次函数调用贵百倍、缓存/批量读存在的理由。

**术语速查**：Ring0/3=硬件门禁|系统调用=服务窗口|登记成本=每次进门的税

<!--advanced-->
 meltdown/spectre 的越权读（推测执行戳破隔离的 2018 事件）。内核模块与 eBPF（「给用户开有监督的小灶」）。用户态驱动（SPDK/DPDK——把门禁换个活法）。
