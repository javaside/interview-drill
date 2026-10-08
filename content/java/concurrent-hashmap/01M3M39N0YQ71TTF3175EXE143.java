package com.interview.java.concurrenthashmap;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;

/**
 * 题目：ConcurrentHashMap 的 size 准确吗？
 * 题卡：01M3M39N0YQ71TTF3175EXE143
 * 块：java/concurrent-hashmap
 *
 * 要点口径（与题卡一致）：
 *  - size() 把 baseCount 和所有 CounterCell 格子加起来——求和期间别的线程还在写格子
 *  - 拿到的是某一瞬间的近似值（弱一致）：调用两次可能不同
 *  - 刻意设计：精确全局计数需要全局锁/单一计数器，会把所有写线程堵在一点
 *  - 真需要精确：快照语义或业务上自己维护计数（LongAdder 思想同源）
 */
public class ChmSizeDemo {

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. size() 的实现：baseCount + CounterCell 格子求和 ==");
        System.out.println("  CHM 不维护单一精确计数器：写操作优先写到自己那格 CounterCell，");
        System.out.println("  size() 时把 baseCount + 所有格子加起来——求和期间别的线程还在写格子。");

        System.out.println();
        System.out.println("== 2. 写完之后 size 是准的；边写边数才近似 ==");
        ConcurrentHashMap<Integer, Integer> map = new ConcurrentHashMap<>();
        for (int i = 0; i < 1000; i++) map.put(i, i);
        System.out.println("  写完再数（此刻没有并发写）: size=" + map.size() + "（准确）");

        System.out.println();
        System.out.println("== 3. 演示：一边写一边读 size，两次读数可能不同 ==");
        CountDownLatch start = new CountDownLatch(1);
        Thread writer = new Thread(() -> {
            try { start.await(); } catch (InterruptedException ignored) { }
            for (int i = 1000; i < 5000; i++) map.put(i, i);
        });
        writer.start();
        start.countDown(); // 放行 writer
        int s1 = map.size();
        Thread.sleep(1);   // 给 writer 一点写入时间（不保证精确交错，只为观察漂移）
        int s2 = map.size();
        writer.join();
        int s3 = map.size();
        System.out.println("  写入中第一次读: " + s1);
        System.out.println("  写入中第二次读: " + s2 + (s1 != s2 ? "（变了——写还在进行）" : "（这次恰好没变）"));
        System.out.println("  写完再读:       " + s3 + "（写入停止后就是准的）");

        System.out.println();
        System.out.println("== 4. 为什么刻意不准？==");
        System.out.println("  精确全局计数 = 单一计数器/全局锁 = 所有写线程堵在同一个争用点，得不偿失；");
        System.out.println("  分散格子各写各的（LongAdder 的 cell 思想同源），求和时再汇总——以弱一致换吞吐。");
        System.out.println("  mappingCount() 与 size() 同义（long 返回，上限友好）。");
        System.out.println("  真需要精确「某一刻有多少」：接受停顿做快照（copy 后数），或业务自己维护计数器。");
        System.out.println("  注意 isEmpty()==(size()==0) 在并发写下也只是瞬时观察。");
    }
}
