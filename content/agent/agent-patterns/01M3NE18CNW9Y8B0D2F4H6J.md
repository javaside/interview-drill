---
id: 01M3NE18CNW9Y8B0D2F4H6J
blockId: agent/agent-patterns
relatedBlocks:
  []
question: "MCP（Model Context Protocol）解决什么问题？"
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - MCP 和 function calling 冲突吗？
  - MCP Server 有什么安全注意点？
keyPoints:
  - id: kp-ap5-1
    text: "痛点：每个应用 × 每个模型 × 每个工具都要单独对接——M×N 爆炸"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.anthropic.com/en/docs/agents-and-tools/overview
      locator: 'MCP'
  - id: kp-ap5-2
    text: "MCP 统一「工具/资源/提示」的发现与调用协议——M+N"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.anthropic.com/en/docs/agents-and-tools/overview
      locator: 'MCP'
  - id: kp-ap5-3
    text: "角色：Host（应用）连接 MCP Server（工具提供方），即插即用"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.anthropic.com/en/docs/agents-and-tools/overview
      locator: 'MCP'
  - id: kp-ap5-4
    text: "类比 USB：工具做成标准外设，任何支持 MCP 的应用都能插"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.anthropic.com/en/docs/agents-and-tools/overview
      locator: 'MCP'
  - id: kp-ap5-5
    text: "现状：主流模型与应用已原生支持——自建工具生态的事实标准"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.anthropic.com/en/docs/agents-and-tools/overview
      locator: 'MCP'
---

**MCP 解决的是集成爆炸**：没有它，「Claude+GPT×搜索+数据库+GitHub+内部 CRM」每个组合都要写一遍胶水——M×N 份。**MCP 把「工具的发现、描述、调用」标准化**：工具方实现一次 MCP Server，所有支持 MCP 的应用即插即用——M+N。

```
你的应用（Host）
   ├─ MCP Server: GitHub（issue/PR 工具）
   ├─ MCP Server: Postgres（查询工具）
   └─ MCP Server: 公司内部 CRM（自研一次，全生态可用）
```

**与 function calling 的关系**：不冲突，**分层**——function calling 是模型层的调用机制（意图怎么表达），MCP 是生态层的分发协议（工具怎么被发现与接入）。模型照常「决定调用」，MCP 只负责把工具清单和执行通道标准化。

**USB 类比**：MCP 之前每个设备配一根专用线；MCP 之后所有设备一个 USB 口——工具市场因此成立（写一个 MCP Server，全生态的用户都能用）。

**安全注意**：MCP Server 是**外部代码边界**——第三方 server 可能描述与行为不符（描述说只读、实际会写）；接入要审权限最小化、来源可信，工具调用结果也别当可信数据。

**术语速查**：M×N 爆炸=集成地狱|M+N=协议的胜利|USB 化=工具即外设

<!--advanced-->
MCP 三原语（tools 可调用 / resources 可读数据 / prompts 模板）。传输演进（stdio 本地到 streamable HTTP 远程）。OAuth 与 server 鉴权的补课。tools 列表变化的动态通知。
