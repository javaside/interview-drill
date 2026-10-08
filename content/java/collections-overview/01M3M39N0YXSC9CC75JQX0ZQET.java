package com.interview.java.collections;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * 题目：HashSet、LinkedHashSet、TreeSet 的区别？
 * 题卡：01M3M39N0YXSC9CC75JQX0ZQET
 * 块：java/collections-overview
 *
 * 要点口径（与题卡一致）：
 *  - HashSet：无序哈希集 O(1)，去重 = hashCode 定位 + equals 确认
 *  - LinkedHashSet：多花内存维护插入顺序的链
 *  - TreeSet：红黑树按大小排序（自然序或 Comparator），O(log n)，支持范围查询
 *  - 去重口径不同：HashSet 系走 equals；TreeSet 走 compare 返回 0
 */
public class SetVariantsDemo {

    /** equals 相同但 compareTo 不同——让两种去重口径显形 */
    static class Money implements Comparable<Money> {
        final int yuan;
        final String tag; // 不参与 equals，参与 compareTo
        Money(int yuan, String tag) { this.yuan = yuan; this.tag = tag; }

        @Override
        public boolean equals(Object o) { return o instanceof Money m && yuan == m.yuan; }
        @Override
        public int hashCode() { return Objects.hash(yuan); }
        @Override
        public int compareTo(Money o) { return Integer.compare(yuan, o.yuan); }
        @Override public String toString() { return yuan + "元[" + tag + "]"; }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 顺序差异 ==");
        Set<Integer> hash = new HashSet<>(java.util.List.of(30, 1, 200, 5, 99));
        Set<Integer> linked = new LinkedHashSet<>(java.util.List.of(30, 1, 200, 5, 99));
        Set<Integer> tree = new TreeSet<>(java.util.List.of(30, 1, 200, 5, 99));
        System.out.println("  HashSet:       " + hash + "  （哈希分布序，无意义）");
        System.out.println("  LinkedHashSet: " + linked + "  （插入序）");
        System.out.println("  TreeSet:       " + tree + "  （比较序）");

        System.out.println();
        System.out.println("== 2. 复杂度与代价 ==");
        System.out.println("  HashSet       O(1) 增删查，无序——不在乎顺序的默认选择");
        System.out.println("  LinkedHashSet O(1) + 一点内存（双向链），遍历 = 插入序");
        System.out.println("  TreeSet       O(log n)，要排序/范围查询才值得");

        System.out.println();
        System.out.println("== 3. TreeSet 的范围查询 ==");
        TreeSet<Integer> scores = new TreeSet<>(java.util.List.of(60, 75, 82, 90, 98));
        System.out.println("  headSet(82) 不含 82 -> " + scores.headSet(82));
        System.out.println("  tailSet(82) 含 82   -> " + scores.tailSet(82));
        System.out.println("  subSet(75, 90)      -> " + scores.subSet(75, 90));
        System.out.println("  first/last          -> " + scores.first() + " / " + scores.last());

        System.out.println();
        System.out.println("== 4. 去重口径不同：equals vs compareTo == 0 ==");
        // 两个对象 equals 相同（都是 100 元）但 compareTo 不为 0？不可能——本例 compareTo 只看 yuan，
        // 所以造「equals 不同但 compareTo 为 0」更能显形口径差异：
        Set<Money> hashMoney = new HashSet<>();
        hashMoney.add(new Money(100, "a"));
        hashMoney.add(new Money(100, "b")); // equals 相同 -> 被去重
        System.out.println("  HashSet 装两个 equals 相同的 -> " + hashMoney.size() + " 个（走 equals）");

        TreeSet<Money> treeMoney = new TreeSet<>();
        treeMoney.add(new Money(100, "a"));
        treeMoney.add(new Money(100, "b")); // compareTo == 0 -> 被去重（尽管 equals 也相同）
        treeMoney.add(new Money(50, "c"));
        treeMoney.add(new Money(200, "d"));
        System.out.println("  TreeSet: " + treeMoney);
        System.out.println("  TreeSet 判等走 compare 返回 0——equals 相同但 compare 不为 0 的对象【能共存】；");
        System.out.println("  建议 compareTo 与 equals 口径一致，否则出现「相等却共存」的怪象。");

        System.out.println();
        System.out.println("进阶：LinkedHashSet 是 LinkedHashMap accessOrder=false 形态；TreeSet 本质 TreeMap 的键视图；");
        System.out.println("      HashSet 初始容量 16 负载 0.75 与 HashMap 同源；自定义对象入 HashSet 必须成对重写 hash+equals。");
    }
}
