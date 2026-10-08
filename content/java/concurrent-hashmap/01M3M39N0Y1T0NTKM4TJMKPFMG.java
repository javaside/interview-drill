package com.interview.java.concurrenthashmap;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;

/**
 * 题目：Collections.synchronizedMap 和 ConcurrentHashMap 怎么选？
 * 题卡：01M3M39N0Y1T0NTKM4TJMKPFMG
 * 块：java/concurrent-hashmap
 *
 * 要点口径（与题卡一致）：
 *  - synchronizedMap：全方法套同一把锁——任何读写全局排队，并发一高吞吐崩塌
 *  - ConcurrentHashMap：读无锁、写只锁一个桶——高并发吞吐差出数量级；迭代弱一致不炸 CME
 *  - 默认答案 CHM；synchronizedMap 残存价值：需要整表一致的瞬时快照
 */
public class SyncMapVsChmDemo {

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. 机制对比 ==");
        System.out.println("  synchronizedMap: 一把锁守全表——任何读写都全局排队；迭代还得手动持锁。");
        System.out.println("  ConcurrentHashMap: 读无锁（volatile 读）、写只锁一个桶——不同桶互不干扰。");

        System.out.println();
        System.out.println("== 2. 吞吐对比（16 线程争用同一片热点 key，共 320 万次混合读写）==");
        System.out.printf("  synchronizedMap      : %8.1f ms%n", benchmark(Collections.synchronizedMap(new HashMap<>())));
        System.out.printf("  ConcurrentHashMap    : %8.1f ms%n", benchmark(new ConcurrentHashMap<>()));
        System.out.println("  全局锁下 16 线程排队；CHM 读无锁、写只锁桶——热点分散时差距更明显。");

        System.out.println();
        System.out.println("== 3. 迭代行为：弱一致 vs 手动持锁 ==");
        Map<Integer, Integer> chm = new ConcurrentHashMap<>();
        for (int i = 0; i < 10; i++) chm.put(i, i);
        Thread writer = new Thread(() -> { for (int i = 100; i < 110; i++) chm.put(i, i); });
        writer.start();
        int seen = 0;
        for (Integer k : chm.keySet()) { seen++; } // 遍历中另一线程在写
        writer.join();
        System.out.println("  CHM 边写边迭代：正常完成（遍历了 " + seen + " 个，可能含或不含并发插入），不抛 CME。");
        System.out.println("  synchronizedMap 迭代期间必须 synchronized(map){...}，否则照样 CME。");

        System.out.println();
        System.out.println("== 4. 选型 ==");
        System.out.println("  默认答案：ConcurrentHashMap。");
        System.out.println("  synchronizedMap 残存价值：需要「迭代期间整表冻结」的一致快照语义时，");
        System.out.println("  一把大锁反而语义直接。");
        System.out.println("进阶：CHM 迭代器 weakly consistent——保证遍历到创建时已存在且未被删的元素；");
        System.out.println("      需要不可变快照可用 new HashMap<>(chm) 弱一致拷贝；");
        System.out.println("      batch 基操作 forEach/search/reduce 走 ForkJoin common pool 并行。");
    }

    static double benchmark(Map<Integer, Integer> map) throws InterruptedException {
        // 预热（触发 JIT 编译与 map 初始化，避免「谁先跑谁吃亏」）
        for (int i = 0; i < 1_000; i++) map.put(i, i);
        final int threads = 16, opsPerThread = 200_000;
        CountDownLatch ready = new CountDownLatch(threads), done = new CountDownLatch(threads);
        long t0 = System.nanoTime();
        for (int t = 0; t < threads; t++) {
            new Thread(() -> {
                ready.countDown();
                try { ready.await(); } catch (InterruptedException ignored) { }
                for (int i = 0; i < opsPerThread; i++) {
                    // 热点 key 空间（0~999）：16 线程抢同一片数据，争用真实存在
                    int k = i % 1_000;
                    if (i % 3 == 0) map.put(k, i);   // 1/3 写
                    else map.get(k);                 // 2/3 读
                }
                done.countDown();
            }).start();
        }
        done.await();
        return (System.nanoTime() - t0) / 1e6;
    }
}
