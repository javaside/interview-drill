package com.interview.java.collections;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

/**
 * 题目：ArrayList 和 LinkedList 怎么选？
 * 题卡：01M3M39N0YB2X9VHX7VG25RCR8
 * 块：java/collections-overview
 *
 * 要点口径（与题卡一致）：
 *  - 数据结构课直觉「插删多用链表」——实践中几乎总是错的
 *  - ArrayList：内存连续数组 -> 按下标一步到位、CPU 缓存行友好、尾部均摊 O(1)、
 *    中间插入只是挪后半段（memmove 极快）
 *  - LinkedList：随机访问顺链爬 O(n)、每元素两个引用的内存、缓存局部性差
 *  - 默认 ArrayList；LinkedList 只在双端队列场景勉强值回票价，且通常 ArrayDeque 更好
 */
public class ArrayListVsLinkedListDemo {

    public static void main(String[] args) {
        final int N = 200_000;

        System.out.println("== 1. 随机访问：数组直达 vs 顺链爬 ==");
        ArrayList<Integer> al = new ArrayList<>(N);
        LinkedList<Integer> ll = new LinkedList<>();
        for (int i = 0; i < N; i++) { al.add(i); ll.add(i); }

        long t0 = System.nanoTime();
        long sumAl = 0;
        for (int k = 0; k < N; k += 1000) sumAl += al.get(k); // 数组：base + index*4 一步定位
        long alCost = System.nanoTime() - t0;

        long t1 = System.nanoTime();
        long sumLl = 0;
        for (int k = 0; k < N; k += 1000) sumLl += ll.get(k); // 链表：从头顺着 next 爬
        long llCost = System.nanoTime() - t1;

        System.out.printf("  ArrayList.get: %8.2f ms%n", alCost / 1e6);
        System.out.printf("  LinkedList.get: %8.2f ms (慢 %d 倍)%n", llCost / 1e6, Math.max(1, llCost / Math.max(1, alCost)));
        System.out.println("  （LinkedList.get(k) 平均要爬 k/2 个节点，CPU 缓存还不停 miss）");

        System.out.println();
        System.out.println("== 2. 中间插入：挪半段内存 vs 先爬到位置 ==");
        ArrayList<Integer> al2 = new ArrayList<>(List.of(1, 2, 3, 4, 5));
        LinkedList<Integer> ll2 = new LinkedList<>(List.of(1, 2, 3, 4, 5));
        al2.add(2, 99); // System.arraycopy 挪后半段——向量化块移动，极快
        System.out.println("  ArrayList 中间插: " + al2);
        System.out.println("  链表虽然插入本身 O(1)，但【定位】那步就是 O(n)——总账还是 O(n)。");

        System.out.println();
        System.out.println("== 3. 尾部追加：两者都快，ArrayList 均摊 O(1) ==");
        long t2 = System.nanoTime();
        ArrayList<Integer> alTail = new ArrayList<>(N);
        for (int i = 0; i < N; i++) alTail.add(i);
        System.out.printf("  ArrayList 尾部追加 %d 个: %.2f ms（扩容均摊后 O(1)）%n",
                N, (System.nanoTime() - t2) / 1e6);

        System.out.println();
        System.out.println("== 4. 内存开销 ==");
        System.out.println("  LinkedList 每个元素一个 Node 对象 + 前后两个引用：");
        System.out.println("  new Node 次数 = 元素数，GC 压力大、指针追逐 cache miss；");
        System.out.println("  ArrayList 就一块连续数组。");

        System.out.println();
        System.out.println("结论：默认 ArrayList。「插删多用链表」的直觉在实践中几乎总是错的；");
        System.out.println("      双端队列场景（滑动窗口）优先 ArrayDeque（循环数组），仍轮不到 LinkedList。");
    }
}
