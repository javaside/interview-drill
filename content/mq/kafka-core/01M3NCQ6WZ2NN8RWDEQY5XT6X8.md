---
id: 01M3NCQ6WZ2NN8RWDEQY5XT6X8
blockId: mq/kafka-core
relatedBlocks: []
question: Kafka 为什么快？
cardType: enumeration
appliesTo: Kafka 3.x / RocketMQ 5.x
frequency: high
followUps:
  - 零拷贝快在哪？
keyPoints:
  - id: kp-kc5-1
    text: 顺序写：日志只追加（append）——磁盘顺序写接近内存
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc5-2
    text: 页缓存：读写都走 OS page cache——不自己管缓存
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc5-3
    text: 零拷贝：sendfile 直送网卡，数据不经用户态
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc5-4
    text: 批量+压缩：攒批传输、端到端压缩，摊薄网络与 IO
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
  - id: kp-kc5-5
    text: 分区并行：吞吐随 partition 数与 Broker 数水平扩展
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://kafka.apache.org/documentation/
      locator: doc
---

Kafka 的性能是**四个「不折腾」**的叠加：

1. **顺序写**：分区日志**只追加不修改**——磁盘顺序写吞吐是随机写的百倍级（磁头不寻道/SSD 顺序友好）；
2. **页缓存**：读写全走**操作系统 page cache**——Kafka 不自建缓存（进程重启缓存还在！）；
3. **零拷贝**：消费时 `sendfile` 系统调用——数据从**页缓存直达网卡**，跳过「内核→用户→内核」的两次拷贝与上下文切换（省 2 次拷贝+2 次切换）；
4. **批量与压缩**：生产端攒批发送、整批压缩（lz4/zstd）——网络与 IO 按批摊薄。

再叠加**分区并行**——单 topic 吞吐 = Σ各 partition，横向加机器线性涨。

**术语速查**：append-only=只追加｜页缓存=借 OS 的缓存｜sendfile=缓存直达网卡

<!--advanced-->
sendfile 的 DMA gather（scatter-gather）变体仅传描述符不拷贝数据。索引文件（.index/.timeindex）稀疏映射定位。时间轮+delayed operation 的网络层批处理。KIP 调优：num.replica.fetchers/网络线程与 IO 线程配比。
