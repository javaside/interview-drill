---
id: 01M3NE18CNS3B5D7F9H1J3M5N7R
blockId: os/process-thread
relatedBlocks: []
question: 进程有哪些状态？僵尸进程怎么产生、怎么清理？
cardType: enumeration
appliesTo: Linux
frequency: high
followUps:
  - 孤儿进程和僵尸进程的区别？
  - ps 里 S+ 与 D 是什么信号？
keyPoints:
  - id: kp-pt2-1
    text: 五态：运行 R、可中断睡 S、不可中断睡 D、暂停 T、僵尸 Z
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt2-2
    text: 僵尸=已退出但父进程没收尸（exit 状态残留 PCB）
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt2-3
    text: 大量僵尸耗尽 pid 与 PCB——病根在父进程没调 wait
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt2-4
    text: 清理：让父进程 wait/waitpid；或杀掉父进程让 init 接管收尸
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
  - id: kp-pt2-5
    text: D 状态（不可中断 IO）杀不掉——通常磁盘/存储卡死，查硬件路径
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3NE18CNTK1C3E5G7K9S1V3
      - 01M3NE18CNTN5G7K9S1V3X5Z7
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://man7.org/linux/man-pages/man7/sched.7.html
      locator: proc(5)
---

**五态模型**（`ps`/`top` 里的字母）：

```
R 运行/就绪 —— 正在 CPU 上或排队候 CPU
S 可中断睡眠 —— 候事件（IO/锁/信号能唤醒）——常态
D 不可中断睡眠 —— 候磁盘 IO，信号也叫不醒——杀不掉别怪 kill
T 暂停 —— SIGSTOP/Ctrl+Z
Z 僵尸 —— 已退出、尸体未收
```

**僵尸的来龙去脉**：子进程 `exit()` 释放内存/fd，**但内核保留它的「退出状态+PID」一小块 PCB**——这是留给父进程的遗言（`wait()` 来取）。父进程**不 wait**，这块 PCB 就一直是 Z。单个僵尸无害，**成百上千**就耗尽 PID（fork 失败）。治理：①父进程正常 `wait/waitpid`（或 SIGCHLD 处理器里 wait）；②父进程写得烂——**杀掉父进程**，僵尸过继给 init（pid 1）立即收尸。

**孤儿进程**（父先死）与僵尸相反：init 收养后正常活着，不是病。

**D 状态**是另一路警报：进程卡在**不可中断的磁盘 IO**（NFS 断连/磁盘坏/IO 挂死）——kill -9 也无效（信号根本递不进去），得查底层存储。

**术语速查**：收尸=父进程 wait 取退出码|过继 init=杀父后的收养|D 态=IO 卡死连信号都进不去

<!--advanced-->
subreaper（PR_SET_CHILD_SUBREAPER——容器里 pid1 的收尸责任）。JNI/云函数里的 fork 泄漏事故（fork 后不 wait 常见于调用外部命令没 close 进程句柄）。pid namespace 与容器僵尸堆积的经典故障。
