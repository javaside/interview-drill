---
id: 01M3NE18CNQ6Y0D2F4H6J8M0N
blockId: network/http-protocol
relatedBlocks:
  []
question: "浏览器 HTTP 缓存：强缓存与协商缓存？"
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 为什么 index.html 不能设置长缓存？
  - ETag 怎么生成才有意义？
keyPoints:
  - id: kp-hp5-1
    text: "强缓存：Cache-Control（max-age）内不发请求，直接用本地副本"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: 'RFC 9111'
  - id: kp-hp5-2
    text: "协商缓存：带 If-None-Match/If-Modified-Since 问一下，没变回 304"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: 'RFC 9111'
  - id: kp-hp5-3
    text: "ETag 优先于 Last-Modified：内容指纹精确，秒级修改不漏判"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: 'RFC 9111'
  - id: kp-hp5-4
    text: "资源刷新策略：带 hash 文件名万年长缓存，HTML 本身不缓存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: 'RFC 9111'
  - id: kp-hp5-5
    text: "私有与共享：private 仅浏览器，public 允许 CDN/代理缓存"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: 'RFC 9111'
---

HTTP 缓存分两级，**先问要不要发请求**：

- **强缓存**（不发请求）：`Cache-Control: max-age=31536000` 之内，浏览器**直接用本地副本**，连请求都不发（DevTools 显示 200 from disk cache）。Expires 是它的 HTTP/1.0 老前辈（绝对时间，受客户端时钟影响，被 Cache-Control 覆盖）；
- **协商缓存**（发请求轻量确认）：本地副本过期后，带凭证问服务端「变没变」——`If-None-Match: <ETag>`（内容指纹）或 `If-Modified-Since: <时间>`；没变则回 **304**（无 body），继续用副本；变了回 200 全量。**ETag 优先**：Last-Modified 只到秒（一秒内改两次漏判、内容复原误判），ETag 按内容哈希精确。

**前端工程化的黄金组合**：文件名**带内容 hash**（app.3f9a.js）——内容变名字变 → **max-age=immutable 万年缓存**；**index.html 不缓存**（或 no-cache 协商）——保证用户拿到引用新 hash 的入口。二者配合，「强缓存+精确失效」兼得。

**术语速查**：不发请求=强缓存｜问一句变没变=协商｜hash 文名=变内容即换名

<!--advanced-->
no-cache（可存但每次协商）与 no-store（彻底不存）的精确语义。immutable 标志与 F5/Ctrl+F5 的行为差异（强制刷新带 no-cache 头绕过强缓存）。Vary 头（按 Accept-Encoding 分缓存副本）。CDN 侧的 s-maxage 与浏览器 max-age 分层。
