package com.interview.java.concurrenthashmap;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 题目：JDK 8 的 ConcurrentHashMap 是怎么保证线程安全的？
 * 题卡：01M3M39N0YXYJH4J5XV6Q6V6TZ
 * 块：java/concurrent-hashmap
 *
 * 要点口径（与题卡一致）：
 *  - get：全程不加锁——数组和节点字段都 volatile，读到的永远是最新值
 *  - put：桶是空 -> CAS 直接塞；桶有人 -> synchronized 锁住桶的头节点（锁粒度=一个桶）
 *  - size：不维护精确计数，CounterCell 数组分散累加
 *  - 对比 1.7 分段锁（Segment）：8 粒度更细（桶级），用内建 synchronized（锁升级优化）替代自定义锁
 *
 * 本题为讲解性演示：内部字段不反射，用行为佐证 + 文字推演。
 */
public class ChmLockGranularityDemo {

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. 三件套 ==");
        System.out.println("  get  : 无锁——table 与 Node.val/next 都是 volatile 读，永远读到最新值；");
        System.out.println("  put  : 桶空 -> CAS 塞入；桶有人 -> synchronized 锁【桶的头节点】；");
        System.out.println("  size : CounterCell 分散累加（见 ChmSizeDemo），不做精确计数。");

        System.out.println();
        System.out.println("== 2. 锁粒度佐证：不同桶的写互不阻塞 ==");
        ConcurrentHashMap<Integer, Integer> map = new ConcurrentHashMap<>();
        // 一个「慢 put」：key 落在 0 号桶附近（hash 扰动后难精确控制，改用统计证明）
        // 统计证明：4 个线程各写 25 万个不同 key，无全局锁时耗时远低于单线程串行版的 N 倍
        int threads = 4, perThread = 250_000;
        CountDownLatch done = new CountDownLatch(threads);
        long t0 = System.nanoTime();
        for (int t = 0; t < threads; t++) {
            final int seed = t * 1_000_000;
            new Thread(() -> {
                for (int i = 0; i < perThread; i++) map.put(seed + i, i);
                done.countDown();
            }).start();
        }
        done.await();
        long parallel = System.nanoTime() - t0;

        Map<Integer, Integer> single = new java.util.HashMap<>(); // 串行对照（同量级操作）
        long t1 = System.nanoTime();
        for (int i = 0; i < threads * perThread; i++) single.put(i, i);
        long serial = System.nanoTime() - t1;

        System.out.printf("  4 线程并发 put %d 个: %.1f ms（CHM）%n", threads * perThread, parallel / 1e6);
        System.out.printf("  对照单线程 put 同量: %.1f ms（HashMap）%n", serial / 1e6);
        System.out.println("  并行没有退化成串行 -> 写操作没有全表互斥（只有同桶才竞争）。");

        System.out.println();
        System.out.println("== 3. put 流程推演（文字）==");
        System.out.println("  1) spread(hash) 扰动（同 HashMap 的 h^(h>>>16)）；");
        System.out.println("  2) table 未初始化 -> CAS sizeCtl 抢初始化权；");
        System.out.println("  3) 目标桶空 -> tabAt 看一眼，CAS 塞新节点（无锁快路径）；");
        System.out.println("  4) 桶头 hash==MOVED(-1) -> 正在扩容，先帮忙搬（ForwardingNode 转发）；");
        System.out.println("  5) 否则 synchronized(桶头节点) —— 链上找/尾插，或树上找；");
        System.out.println("  6) addCount：先改 baseCount，争用时写自己的 CounterCell。");

        System.out.println();
        System.out.println("== 4. 与 1.7 分段锁对比 ==");
        System.out.println("  1.7：Segment[] 每段一把 ReentrantLock，锁粒度=一段（默认 16 段）；");
        System.out.println("  1.8：锁粒度=单个桶头；JDK 内建 synchronized 享受锁升级优化");
        System.out.println("       （偏向->轻量级->重量级，无竞争时只是一次 CAS）。");

        System.out.println();
        System.out.println("进阶：tabAt 用 Unsafe.getObjectAcquire（volatile 语义）；hash=-1(MOVED)/-2(TREEBIN)");
        System.out.println("      是状态哨兵；computeIfAbsent 先 CAS 试插 ReservationNode 再锁内执行函数。");
    }
}
