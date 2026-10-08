package com.interview.java.hashmap;

import java.util.HashMap;

/**
 * 题目：JDK 7 的 HashMap 为什么会死循环？8 改了什么？
 * 题卡：01M3M39N0Y173S2T5DGGRY61MJ
 * 块：java/hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 1.7 经典事故：并发扩容 + 头插法 = 环形链
 *  - 两个线程同时 resize，头插法（插到链头，顺序反转）交错执行下两节点互指成环
 *  - 此后 get 落到这条链就原地转圈，CPU 打满
 *  - 1.8 修复：改尾插（保持原序搬迁），环不再可能
 *  - 注意：只是修了死循环，没修线程安全——并发 put 照样丢数据；并发就 ConcurrentHashMap
 *
 * 本题为讲解性演示：JDK17 上无法真实复现 1.7 头插死循环，用推演输出讲解。
 */
public class Jdk7LoopAndJdk8FixDemo {

    /** 极简链表节点，用于手动推演两种搬迁方式 */
    static class Node {
        final int hash;
        String key;
        Node next;
        Node(int hash, String key) { this.hash = hash; this.key = key; }
    }

    /** JDK7 风格：头插搬迁（新节点插到新桶链头——顺序反转） */
    static Node[] transferHeadInsert(Node[] oldTable) {
        Node[] newTable = new Node[oldTable.length * 2];
        for (Node e : oldTable) {
            while (e != null) {
                Node next = e.next;      // 1.7 transfer 的第一步：先记住 next
                int idx = e.hash & (newTable.length - 1);
                e.next = newTable[idx];  // 新节点指向当前链头（头插）
                newTable[idx] = e;       // 自己成为新链头
                e = next;
            }
        }
        return newTable;
    }

    /** JDK8 风格：尾插/原序搬迁（拆链：按新增 bit 劈成 lo/hi 两条，各自保持原序） */
    static Node[] transferTailInsert(Node[] oldTable) {
        Node[] newTable = new Node[oldTable.length * 2];
        for (Node head : oldTable) {
            Node loHead = null, loTail = null, hiHead = null, hiTail = null;
            for (Node e = head; e != null; e = e.next) {
                if ((e.hash & oldTable.length) == 0) {   // 新增位是 0 -> 留原桶
                    if (loTail == null) loHead = e; else loTail.next = e;
                    loTail = e;
                } else {                                  // 新增位是 1 -> 去 原下标+旧容量
                    if (hiTail == null) hiHead = e; else hiTail.next = e;
                    hiTail = e;
                }
            }
            if (loTail != null) { loTail.next = null; newTable[index(head.hash, oldTable.length)] = loHead; }
            if (hiTail != null) { hiTail.next = null; newTable[index(head.hash, oldTable.length) + oldTable.length] = hiHead; }
        }
        return newTable;
    }

    static int index(int hash, int cap) { return hash & (cap - 1); }

    static String chainOf(Node n) {
        StringBuilder sb = new StringBuilder();
        java.util.Set<Node> seen = new java.util.HashSet<>();
        while (n != null) {
            if (!seen.add(n)) { sb.append(" ⟲成环!(").append(n.key).append(")"); return sb.toString(); }
            if (sb.length() > 0) sb.append(" -> ");
            sb.append(n.key);
            n = n.next;
        }
        return sb.toString();
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. 单线程下两种搬迁都「看起来正常」==");
        // 构造一条冲突链：hash 都落在 0 号桶（容量 4）
        Node a = new Node(4, "A"); Node b = new Node(4, "B"); Node c = new Node(4, "C");
        a.next = b; b.next = c;
        System.out.println("  原链:           " + chainOf(a));
        Node[] old = new Node[4]; old[0] = a;
        System.out.println("  1.7 头插搬迁后: " + chainOf(transferHeadInsert(old)[0]) + "（顺序反了）");
        old = new Node[4]; old[0] = a;
        System.out.println("  1.8 尾插搬迁后: " + chainOf(transferTailInsert(old)[0]) + "（原序）");

        System.out.println();
        System.out.println("== 2. 1.7 成环的推演（两个线程交错执行头插）==");
        System.out.println("  链: A -> B，线程1和线程2同时 resize，都从头插 A 开始：");
        System.out.println("  t1: next=B; A.next=newTable[i](null); newTable[i]=A;  <- t1 停在这里被挂起");
        System.out.println("  t2: 完整搬完：B -> A（头插反转），且 t2 的 newTable 与 t1 是同一个引用的场景下");
        System.out.println("  t1: 醒来继续：取 e=B; B.next=newTable[i]=A; newTable[i]=B;");
        System.out.println("      此时 A.next=B（t2 搬的结果），B.next=A（t1 刚写的）—— A、B 互指成环！");
        System.out.println("  成因一句话：头插法会改写已有节点的 next 指向（e.next = newTable[i]），");
        System.out.println("  两线程交错写回 next，交叉引用成环。此后 get 落到这条链 -> while 原地转圈，CPU 打满。");

        System.out.println();
        System.out.println("== 3. 1.8 的修复：尾插 + 拆链 ==");
        System.out.println("  尾插只把节点接到链尾，不改写已有节点的 next 方向 -> 交错执行不再成环；");
        System.out.println("  且拆链按「新增 bit」一分为二（lo/hi），不重算 hash、原序平移（见 HashMapResizeDemo）。");

        System.out.println();
        System.out.println("== 4. 重要的澄清：修了死循环 ≠ 线程安全 ==");
        HashMap<Integer, Integer> map = new HashMap<>();
        Thread t1 = new Thread(() -> { for (int i = 0; i < 5_000; i++) map.put(i, i); });
        Thread t2 = new Thread(() -> { for (int i = 5_000; i < 10_000; i++) map.put(i, i); });
        t1.start(); t2.start(); t1.join(); t2.join();
        System.out.println("  JDK17 并发 put 10000 个（期望）: 实际 " + map.size() + " 个——照样丢数据。");
        System.out.println("  结论：需要并发没有例外，用 ConcurrentHashMap（见 concurrenthashmap 包）。");
    }
}
