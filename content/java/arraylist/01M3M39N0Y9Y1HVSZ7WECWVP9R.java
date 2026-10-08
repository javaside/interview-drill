package com.interview.java.arraylist;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Vector;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 题目：ArrayList 是线程安全的吗？有哪些替代？
 * 题卡：01M3M39N0Y9Y1HVSZ7WECWVP9R
 * 块：java/arraylist
 *
 * 要点口径（与题卡一致）：
 *  - 不安全。两类替代：
 *  - Collections.synchronizedList(list)：每方法套 synchronized——读写全排队，迭代还得手动加锁
 *  - CopyOnWriteArrayList：每次写复制新数组、原子换引用——读永远无锁（读旧快照）
 *  - 选型：读多写少 COW；写多就加锁或换并发队列
 */
public class ArrayListThreadSafetyDemo {

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. ArrayList 并发写：丢数据 ==");
        List<Integer> unsafe = new ArrayList<>();
        Thread t1 = new Thread(() -> { for (int i = 0; i < 10_000; i++) unsafe.add(i); });
        Thread t2 = new Thread(() -> { for (int i = 0; i < 10_000; i++) unsafe.add(i); });
        t1.start(); t2.start(); t1.join(); t2.join();
        System.out.println("  期望 20000，实际 " + unsafe.size() + "（并发 add 互相覆盖/扩容竞态导致丢失）");
        System.out.println("  还可能抛 ArrayIndexOutOfBoundsException——两个线程同时触发扩容搬家。");

        System.out.println();
        System.out.println("== 2. synchronizedList：全方法排队，安全但慢 ==");
        List<Integer> sync = Collections.synchronizedList(new ArrayList<>());
        Thread t3 = new Thread(() -> { for (int i = 0; i < 10_000; i++) sync.add(i); });
        Thread t4 = new Thread(() -> { for (int i = 0; i < 10_000; i++) sync.add(i); });
        t3.start(); t4.start(); t3.join(); t4.join();
        System.out.println("  结果 " + sync.size() + "（对）；注意：迭代它仍要手动 synchronized(list)，否则照样 CME。");
        System.out.println("  复合操作（if(!contains) add）方法级锁保证不了原子性，仍需外部同步。");

        System.out.println();
        System.out.println("== 3. CopyOnWriteArrayList：读无锁，写时复制 ==");
        CopyOnWriteArrayList<Integer> cow = new CopyOnWriteArrayList<>();
        Thread t5 = new Thread(() -> { for (int i = 0; i < 2_000; i++) cow.add(i); }); // 写少
        Thread t6 = new Thread(() -> { for (int i = 0; i < 2_000; i++) cow.add(i); });
        t5.start(); t6.start(); t5.join(); t6.join();
        System.out.println("  结果 " + cow.size() + "（对）；读的是稳定快照，迭代永远不炸。");
        System.out.println("  代价：每次 add/remove 全量拷贝数组——写频繁就灾难。");
        System.out.println("  COW 迭代器不支持 remove（抛 UnsupportedOperationException），final 快照引用。");

        System.out.println();
        System.out.println("== 4. 遗留选项 ==");
        Vector<Integer> vector = new Vector<>();
        vector.add(1);
        System.out.println("  Vector 全方法 synchronized，等价 synchronizedList 语义——历史遗留，别新用。");

        System.out.println();
        System.out.println("选型一句话：读多写少（监听器列表、配置表）-> COW；");
        System.out.println("            写多 -> 老老实实加锁（synchronizedList/外部锁）或换并发队列。");
    }
}
