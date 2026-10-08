package com.interview.java.hashmap;

import java.util.HashMap;
import java.util.Map;

/**
 * 题目：HashMap 的底层数据结构是什么？
 * 题卡：01M3M39N0Y0X94ER3V9S382ZT0
 * 块：java/hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 一个大数组，每个槽位挂一条小链表（冲突的键排队），链太长(>=8)升级成红黑树
 *  - 定位：key 的 hash 与 (n-1) 按位与 -> 数组下标（容量是 2 的幂，位运算等价取模但更快）
 *  - 树化：链长 >=8 且数组容量 >=64 -> 红黑树，最坏查找从 O(n) 救回 O(log n)
 *  - 树缩到 6 退回链表（中间隔 2，防止边界抖动）
 */
public class HashMapStructureDemo {

    /** 所有实例 hash 相同：制造完美碰撞，逼出树化路径 */
    static class CollideKey {
        final String id;
        CollideKey(String id) { this.id = id; }
        @Override public int hashCode() { return 42; } // 全部同 hash -> 全进同一个桶
        @Override public boolean equals(Object o) { return o instanceof CollideKey k && id.equals(k.id); }
        @Override public String toString() { return id; }
    }

    public static void main(String[] args) {
        System.out.println("== 结构图 ==");
        System.out.println("table[i] → k1 → k2 → k3 → …（冲突链）");
        System.out.println("        → 树节点（长链的进化形态，查找 O(log n)）");

        System.out.println();
        System.out.println("== 1. 定位公式：(n-1) & hash ==");
        System.out.println("  容量是 2 的幂（16/32/64...），n-1 的二进制是全 1（15=0b1111）；");
        System.out.println("  hash & (n-1) 等价于 hash % n，但位运算更快（不走向量除法）。");
        int n = 16;
        for (int h : new int[]{0, 15, 16, 17, 100, 115}) {
            System.out.printf("  hash=%3d & (n-1)=15 -> 桶 %d（%s）%n", h, h & (n - 1),
                    (h % n) == (h & (n - 1)) ? "与取模一致" : "不一致?!");
        }

        System.out.println();
        System.out.println("== 2. 树化行为演示：1000 个 key 全部同 hash（单桶地狱）==");
        Map<CollideKey, Integer> map = new HashMap<>();
        long t0 = System.nanoTime();
        for (int i = 0; i < 1_000; i++) {
            map.put(new CollideKey("k" + i), i);
        }
        long putCost = System.nanoTime() - t0;
        long t1 = System.nanoTime();
        Integer found = map.get(new CollideKey("k999")); // 全靠 equals 逐个比（链）或树查找
        long getCost = System.nanoTime() - t1;
        System.out.printf("  put 1000 个同 hash 键: %.2f ms%n", putCost / 1e6);
        System.out.printf("  get(\"k999\") -> %s, 耗时 %.3f ms%n", found, getCost / 1e6);
        System.out.println("  若没有树化，单桶 1000 节点是 O(n) 链表；链长 >=8 且容量 >=64 后树化，");
        System.out.println("  查找救回 O(log n)——所以这种「恶意碰撞」下依然可用。");

        System.out.println();
        System.out.println("== 3. 树化/退化阈值 ==");
        System.out.println("  链长 >= 8 且 table 容量 >= 64 -> 树化（容量不足 64 先扩容不树化）；");
        System.out.println("  树节点缩到 6 -> 退回链表（8 与 6 隔 2，防止在边界来回切换抖动）。");

        System.out.println();
        System.out.println("进阶：良好 hash 下链长到 8 的概率约千万分之六（泊松分布论证）——");
        System.out.println("      树化是兜底而非常态（攻击或劣质 hashCode 才常态触发）；");
        System.out.println("      TreeNode 体积两倍于 Node；tableSizeFor 保证任意初始容量向上取 2 的幂。");
    }
}
