---
id: 01M3M39N0YSKNPV9WB4ESFMHTR
blockId: java/arraylist
relatedBlocks: []
question: ArrayList 的 remove 是怎么工作的？
cardType: enumeration
appliesTo: Java 17+
frequency: mid
followUps:
  - list.remove(1) 和 list.remove(Integer.valueOf(1)) 有何不同？
keyPoints:
  - id: kp-al2-1
    text: 按下标 remove：删元素后把后半段整体前移一位（System.arraycopy）
    public: true
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0YB2X9VHX7VG25RCR8
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-al2-2
    text: 按对象 remove：从头顺序 equals 找到第一个再删
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-al2-3
    text: remove(int) 返回被删元素；remove(Integer) 走按对象查找——重载陷阱
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
  - id: kp-al2-4
    text: modCount++ 使并发迭代中的删除触发 fail-fast
    public: false
    verifiedAt: 2026-09-28
    excludeAsDistractorFor:
      - 01M3M39N0Y9Y1HVSZ7WECWVP9R
      - 01M3M39N0YT67P0ZN2045PD8WT
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.oracle.com/javase/specs/jls/se17/html/index.html
      locator: JLS 17
---

删除的两种入口：

- **按下标** `remove(int index)`：直接定位，把**后面的元素整体前移一格**（数组拷贝），返回被删的元素——**O(n)** 的移动成本。
- **按对象** `remove(Object o)`：从头**顺序 equals** 找到第一个匹配的删——查找 O(n) + 移动 O(n)。

经典陷阱：`list.remove(1)` 删的是**下标 1**；想删「值为 1 的元素」必须 `remove(Integer.valueOf(1))`（显式装箱走对象重载）。

删除同样 modCount++，迭代中直接删会触发 fail-fast（详见集合总览块）。

**术语速查**：前移=后面元素集体往前挪一格｜重载陷阱=int 被当成了下标

<!--advanced-->
removeRange/批量 remove 用位标记（置 null）一次压缩，减少反复拷贝。ensureCapacity 与 trimToSize 分别预留/回收容量。fastRemove 是无边界检查的内部变体（Iterator.remove 复用）。
