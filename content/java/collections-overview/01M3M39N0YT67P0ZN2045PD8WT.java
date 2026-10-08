package com.interview.java.collections;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 题目：什么是 fail-fast？
 * 题卡：01M3M39N0YT67P0ZN2045PD8WT
 * 块：java/collections-overview
 *
 * 要点口径（与题卡一致）：
 *  - 一边迭代一边做结构性修改（加/删元素）-> ConcurrentModificationException
 *  - 原理：modCount（集合修改计数），迭代器创建时抄 expectedModCount，每次 next() 对账
 *  - 单线程 for-each 里 list.remove(x) 同样触发（不是只有多线程才炸）
 *  - 它是尽力而为（对账不是锁），不能当并发保护
 *  - 正确姿势：iterator.remove()、removeIf、或 CopyOnWriteArrayList
 */
public class FailFastDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 事故：for-each 里直接 remove（单线程照样炸）==");
        List<String> list = new ArrayList<>(List.of("a", "bad", "b", "bad", "c"));
        try {
            for (String s : list) {
                if (s.equals("bad")) list.remove(s); // 结构性修改，modCount 变了
            }
        } catch (java.util.ConcurrentModificationException e) {
            System.out.println("  抛出 ConcurrentModificationException！（注意：这是纯单线程）");
        }

        System.out.println();
        System.out.println("== 2. 原理：modCount 对账 ==");
        System.out.println("  集合内部维护 modCount，每次 add/remove +1；");
        System.out.println("  迭代器创建时抄一份 expectedModCount；每次 next() 先对账——");
        System.out.println("  数字对不上 = 有人动过结构 -> 立即抛异常（宁可炸也不默默给出错乱结果）。");
        System.out.println("  澄清：①单线程 for-each 的 remove 同样触发；②它是尽力而为（无锁），不能当并发保护。");

        System.out.println();
        System.out.println("== 3. 正确姿势一：iterator.remove() ==");
        List<String> list2 = new ArrayList<>(List.of("a", "bad", "b", "bad", "c"));
        for (Iterator<String> it = list2.iterator(); it.hasNext(); ) {
            if (it.next().equals("bad")) it.remove(); // 迭代器认可的同款删除，同步 expectedModCount
        }
        System.out.println("  结果: " + list2);

        System.out.println();
        System.out.println("== 4. 正确姿势二：removeIf（内部就是安全的迭代删除）==");
        List<String> list3 = new ArrayList<>(List.of("a", "bad", "b", "bad", "c"));
        list3.removeIf(s -> s.equals("bad"));
        System.out.println("  结果: " + list3);

        System.out.println();
        System.out.println("== 5. 正确姿势三：CopyOnWriteArrayList（弱一致，不炸）==");
        List<String> cow = new CopyOnWriteArrayList<>(List.of("a", "bad", "b"));
        for (String s : cow) {
            if (s.equals("bad")) cow.remove(s); // 迭代的是创建时的快照，安全
        }
        System.out.println("  结果: " + cow + "（迭代器拿着快照遍历，写时复制出新数组）");

        System.out.println();
        System.out.println("进阶：CME 检测是 best-effort（无同步读 modCount，竞态下可能漏检）；");
        System.out.println("      for-each 只是语法糖，本质还是 iterator；");
        System.out.println("      「删完倒数第二个元素恰好不炸」是对账时机造成的侥幸，别依赖。");
    }
}
