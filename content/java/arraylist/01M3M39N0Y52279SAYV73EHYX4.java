package com.interview.java.arraylist;

import java.util.ArrayList;
import java.util.Arrays;

/**
 * 题目：ArrayList 的扩容机制是怎样的？
 * 题卡：01M3M39N0Y52279SAYV73EHYX4
 * 块：java/arraylist
 *
 * 要点口径（与题卡一致）：
 *  - new ArrayList() 内部先是空数组；第一次 add 扩到 10
 *  - 之后放不下：新容量 = 旧的 1.5 倍（oldCap + (oldCap >> 1)）
 *  - 搬家 = 新建数组 + Arrays.copyOf 整体拷贝（O(n) 代价）
 *  - 能预估就传初始容量，一次到位
 */
public class ArrayListGrowDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 扩容序列模拟（与源码公式一致）==");
        System.out.println("  new ArrayList() -> 内部是共享的空数组（不占内存）");
        int cap = 10; // 第一次 add 时扩到 DEFAULT_CAPACITY=10
        System.out.print("  第一次 add -> 10");
        for (int i = 0; i < 6; i++) {
            cap = cap + (cap >> 1); // oldCap + (oldCap >> 1) = 1.5 倍
            System.out.print(" -> " + cap);
        }
        System.out.println();
        System.out.println("  每次 1.5 倍：10 → 15 → 22 → 33 → 49 → 73 → 109 ...");

        System.out.println();
        System.out.println("== 2. 搬家的代价 ==");
        System.out.println("  放不下时：新建数组 + Arrays.copyOf 整体拷贝旧元素 —— O(n)；");
        System.out.println("  均摊到每次 add 后尾部追加仍是均摊 O(1)（偶尔贵一次，平均便宜）。");
        System.out.println("  1.5 倍是折中：空间浪费与再扩频率的平衡（2 倍的渐进浪费 4n vs 1.5 倍的 2.25n）。");

        System.out.println();
        System.out.println("== 3. 搬家次数对比：默认 vs 预估容量 ==");
        int n = 100_000;
        System.out.println("  默认构造，加 " + n + " 个元素要搬家 " + movesOfGrowth(n) + " 次；");
        System.out.println("  new ArrayList<>(" + n + ") 一次到位，搬家 0 次。");
        System.out.println("  能预估就传初始容量：new ArrayList<>(10000)。");

        System.out.println();
        System.out.println("== 4. 拷贝耗时直观感受 ==");
        int[] big = new int[10_000_000];
        Arrays.fill(big, 7);
        long t0 = System.nanoTime();
        int[] copy = Arrays.copyOf(big, (int) (big.length * 1.5)); // 模拟一次搬家
        System.out.printf("  拷贝 %d 个引用耗时 %.2f ms（这就是每次扩容的固定开销）%n",
                big.length, (System.nanoTime() - t0) / 1e6);

        System.out.println();
        System.out.println("进阶：grow 上限 MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8，超限 OutOfMemory；");
        System.out.println("      elementData 是 transient，序列化走 writeObject 只写 size 内元素（不序列化尾部空槽）；");
        System.out.println("      trimToSize 可回收多余容量。");
    }

    /** 模拟默认扩容路径上加 n 个元素需要搬家（扩容）多少次 */
    static int movesOfGrowth(int n) {
        int cap = 10;      // 首次 add 后的容量
        int moves = 0;
        while (cap < n) {
            cap = cap + (cap >> 1);
            moves++;
        }
        return moves;
    }
}
