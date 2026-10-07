---
id: 01M3NE18CNQ3V7X9Z1C3E5G7K
blockId: network/http-protocol
relatedBlocks: []
question: 常见 HTTP 状态码及其含义？
cardType: enumeration
appliesTo: 通用
frequency: high
followUps:
  - 401 和 403 的分界？
  - 502 与 504 哪个更可能是后端挂了？
keyPoints:
  - id: kp-hp2-1
    text: 2xx 成功：200 正常 / 204 无内容 / 206 断点续传部分内容
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp2-2
    text: 3xx 重定向：301 永久 / 302 临时 / 304 缓存有效省传输
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNQ6Y0D2F4H6J8M0N
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp2-3
    text: 4xx 客户端错：400 参数 / 401 未认证 / 403 拒绝 / 404 不存在 / 429 限流
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp2-4
    text: 5xx 服务端错：500 内部 / 502 网关收到坏响应 / 504 网关上游超时
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
  - id: kp-hp2-5
    text: 排查口诀：4xx 先查自己，5xx 先查服务端，502/504 查网关到上游
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://www.rfc-editor.org/rfc/rfc9110.html
      locator: RFC 9110
---

状态码是响应的**体检报告单**，五段分类记骨架、高频记个体：

- **2xx 成功**：200 请求成功；**204 成功但无 body**（DELETE 后常回）；**206 部分内容**（Range 断点续传的基础——视频拖进度条就是它）；
- **3xx 重定向**：**301 永久**（搜索引擎更新收录——换域名用）/ **302 临时**（浏览器继续用旧地址）；**304 Not Modified**（协商缓存命中——内容没变，用你本地那份，省整个 body）；
- **4xx 你这边的问题**：400 参数坏；**401 没登录**（带 WWW-Authenticate）；**403 登录了但没权限**；404 路径不存在；429 请求太频被限流；
- **5xx 服务端的问题**：500 代码炸了；**502 网关收到上游坏响应**（后端崩了/拒绝连接）；**504 网关候上游超时**（后端还在跑但太慢）。

**排查口诀**：4xx 查自己（参数/鉴权/路径），502 后端多半已死，504 后端活着但拖死（慢 SQL/下游堆积）。

**术语速查**：304=缓存命中免传输｜401 vs 403=没进门 vs 进了门没钥匙｜504=活着但太慢

<!--advanced-->
301/302 的 POST 重定向陷阱（历史实现把 POST 转 GET——303/307/308 才是精确语义）。499（Nginx 私有——客户端等不及先断）。502/504 在 LB 视角的产生链路（connect refused vs read timeout）。
