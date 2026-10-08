package com.interview.java.concurrenthashmap;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;

/**
 * 题目：ConcurrentHashMap 的复合操作为什么还要 putIfAbsent？
 * 题卡：01M3M39N0YTT2S98167BKRG71P
 * 块：java/concurrent-hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 「没有就放入」拆成 if(!containsKey) put 两步，并发下中间会漏气：两线程同时查不到、
 *    同时放入——后写覆盖先写
 *  - 原子版本：putIfAbsent(k,v) 没有才放返回旧值；computeIfAbsent(k, 函数) 算+存一步完成
 *  - computeIfAbsent 是缓存的标准姿势；加载函数在锁内执行——要快，且不能再改这张表
 */
public class PutIfAbsentDemo {

    static int loadCount = 0; // 演示 computeIfAbsent 只加载一次

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. 事故：check-then-act 两步在并发下漏气 ==");
        ConcurrentHashMap<String, String> map = new ConcurrentHashMap<>();
        CountDownLatch start = new CountDownLatch(1);
        Runnable racer = () -> {
            try { start.await(); } catch (InterruptedException ignored) { }
            if (!map.containsKey("cfg")) {          // 步骤1：查（都查到没有）
                map.put("cfg", "来自" + Thread.currentThread().getName()); // 步骤2：放（都放了）
            }
        };
        Thread a = new Thread(racer, "线程A"), b = new Thread(racer, "线程B");
        a.start(); b.start(); start.countDown(); a.join(); b.join();
        System.out.println("  两线程同时 check-then-put -> cfg=" + map.get("cfg"));
        System.out.println("  后写的覆盖先写的（加载逻辑可能跑了两次——比如两次查库）。");

        System.out.println();
        System.out.println("== 2. 原子版本：putIfAbsent ==");
        ConcurrentHashMap<String, String> fixed = new ConcurrentHashMap<>();
        String winner = fixed.putIfAbsent("cfg", "线程A的值");
        String loser = fixed.putIfAbsent("cfg", "线程B的值");
        System.out.println("  第一次 putIfAbsent 返回 " + winner + "（null=之前没有，已放入）");
        System.out.println("  第二次 putIfAbsent 返回 " + loser + "（旧值=已存在，不再动）");
        System.out.println("  最终 cfg=" + fixed.get("cfg") + " —— 一步到位，中间不会插进别人。");

        System.out.println();
        System.out.println("== 3. 缓存的标准姿势：computeIfAbsent ==");
        ConcurrentHashMap<Integer, String> cache = new ConcurrentHashMap<>();
        CountDownLatch start2 = new CountDownLatch(1);
        for (int t = 0; t < 8; t++) {
            new Thread(() -> {
                try { start2.await(); } catch (InterruptedException ignored) { }
                // 没有就加载（函数只会在锁内对每个 key 执行一次）
                cache.computeIfAbsent(42, PutIfAbsentDemo::loadFromDb);
            }).start();
        }
        start2.countDown();
        Thread.sleep(200);
        System.out.println("  8 线程同时 computeIfAbsent(42, loadFromDb)：加载次数 = " + loadCount);
        System.out.println("  （loadFromDb 有 synchronized 只为计数，CHM 只保证「同一个 key 函数只跑一次」）");

        System.out.println();
        System.out.println("== 4. 两个注意 ==");
        System.out.println("  ① 加载函数在锁内执行——函数要快；绝不能在函数里再改这张表");
        System.out.println("     （递归 computeIfAbsent 同一个 map -> IllegalStateException/死锁）；");
        System.out.println("  ② 相关联的还有 merge（聚合计数）与 replace(k,old,new)（CAS 语义）。");

        System.out.println();
        System.out.println("结论：复合操作（check-then-act）必须用原子版本：putIfAbsent/computeIfAbsent/merge。");
    }

    static synchronized String loadFromDb(Integer key) {
        loadCount++;
        return "db-value-" + key;
    }
}
