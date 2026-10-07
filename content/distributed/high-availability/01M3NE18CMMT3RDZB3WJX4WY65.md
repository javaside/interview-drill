---
id: 01M3NE18CMMT3RDZB3WJX4WY65
blockId: distributed/high-availability
relatedBlocks: []
question: 优雅停机为什么重要？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - 滚动发布为什么会抖动？
keyPoints:
  - id: kp-ha3-1
    text: 直接 kill：在途请求被拦腰斩断——用户看到 502
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF8JS0KFH32EQ2AXEC
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha3-2
    text: 优雅停机：先摘流量→处理完存量→再退出
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M59WSF8JS0KFH32EQ2AXEC
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha3-3q
    text: K8s：preStop 钩子 + terminationGracePeriodSeconds 配合
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
  - id: kp-ha3-4
    text: 注册中心注销先行：消费者缓存刷新后才真下线
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CMDD5CJ936BEH04P60
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://martin.kleppmann.com/ddia/
      locator: DDIA
---

**直接 kill -9** 的三宗罪：在途请求斩断（用户 502）、注册中心还认为你活着（流量继续来、连接拒绝）、消息处理一半（没 ack，重投还算好的）。

**优雅停机的标准动作**：

1. **先摘流量**：注册中心**注销** / K8s `preStop`（readiness 探针失败摘除 endpoint）——**新流量不再来**；
2. **候存量**：在途请求处理完（Spring 的 graceful shutdown / Web 容器 stop 前 drain）——消费者缓存刷新也需要几秒缓冲；
3. **再退出**：清理资源（线程池 shutdown / MQ 消费者 close）→ 进程退出。

**滚动发布抖动**的常见根因就是没做 1、2（新版本 Pod 起、旧版本 Pod 被直接杀）——K8s 里 preStop sleep 几秒 + 优雅关机是标准补丁。

**术语速查**：摘流量=先下招牌｜drain=排干在途请求｜preStop=容器被杀前的告别时间

<!--advanced-->
SIGTERM vs SIGKILL 的语义。长任务的两段式（标记停新+异步等旧）。MQ 消费者的 shutdown（停止 poll、处理完手头、提交 offset 再退）。
