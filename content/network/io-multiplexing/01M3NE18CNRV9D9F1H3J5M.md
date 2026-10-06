---
id: 01M3NE18CNRV9D9F1H3J5M
blockId: network/io-multiplexing
relatedBlocks: []
question: 零拷贝是什么？sendfile 和 mmap 工作在哪层？
cardType: enumeration
appliesTo: 通用
frequency: mid
followUps:
  - Kafka 为什么快？
  - 为什么叫零拷贝却还有拷贝？
keyPoints:
  - id: kp-io5-1
    text: 传统读发四次拷贝：磁盘→页缓存→用户态→socket 缓冲→网卡
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: sendfile(2)
  - id: kp-io5-2
    text: sendfile：内核里页缓存直达网卡——省两次用户态来回
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: sendfile(2)
  - id: kp-io5-3
    text: mmap+write：映射页缓存进用户地址空间，省一次拷贝
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: sendfile(2)
  - id: kp-io5-4
    text: scatter-gather（DMA）：只传描述符不搬数据，CPU 零参与
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: sendfile(2)
  - id: kp-io5-5
    text: 收益场景：静态文件发送/消息中间件落盘转发；应用要改数据则不适用
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/epoll.7.html
      locator: sendfile(2)
---

「零拷贝」= **砍掉不必要的数据搬运与 CPU 参与**。传统 `read+write` 发文件：

```
磁盘 →(DMA) 页缓存 →(CPU 拷) 用户缓冲 →(CPU 拷) socket 缓冲 →(DMA) 网卡
       内核态           用户态              内核态
```

**4 次拷贝、2 次系统调用、2 次上下文切换**——而用户态对数据**一个字节没改**，纯属路过。

两条省法：

- **sendfile(out_fd, in_fd)**：文件→socket 的内核专线——数据**从页缓存直拷 socket 缓冲**（不经用户态）；配合 **scatter-gather**（网卡支持时）连这次拷贝都省：内核只把「页缓存地址+长度」的描述符给网卡，**DMA 自己去取**——CPU 参与归零。Kafka/RocketMQ/Nginx `sendfile on` 的吞吐根基；
- **mmap+write**：把页缓存**映射**进用户地址空间（读它=直接读页缓存，省一次拷贝）——适合**应用要处理数据**的场景（RocketMQ 消费即 mmap——读消息零用户态拷贝，写仍需 write）。

**边界**：零拷贝只对「**不改数据的中转**」成立——加密/压缩（TLS 下 Nginx 得关 sendfile 或走 kTLS）都要在用户态摸数据，退化回普通路径。

**术语速查**：页缓存=内核的文件缓存|描述符传递=给地址不搬货|只中转不改=零拷贝的前提

<!--advanced-->
kTLS（内核态 TLS——加密下沉，sendfile 在 TLS 时代复活）。splice（管道中转——两 fd 间的零拷贝搬运工）。Direct IO 绕页缓存（数据库自管缓存的取舍）。
