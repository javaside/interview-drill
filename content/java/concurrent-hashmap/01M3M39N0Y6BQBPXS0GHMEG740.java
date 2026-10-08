package com.interview.java.concurrenthashmap;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 题目：ConcurrentHashMap 的 key/value 为什么不允许 null？
 * 题卡：01M3M39N0Y6BQBPXS0GHMEG740
 * 块：java/concurrent-hashmap
 *
 * 要点口径（与题卡一致）：
 *  - HashMap 里 get(k) 返回 null 可用 containsKey(k) 复核「是没有还是值为 null」——单线程可靠
 *  - 并发容器里这个组合失效：两步之间别的线程可能已 put/remove——null 的含义无法判定
 *  - 干脆禁掉 null（key/value 都是），从根上消灭二义性
 */
public class ChmNoNullDemo {

    public static void main(String[] args) {
        System.out.println("== 1. HashMap：null 是合法值，两步复核可行（单线程）==");
        Map<String, String> hashMap = new HashMap<>();
        hashMap.put("absent-key-不存在的", null); // 反例键名，实际放的是下面这个
        hashMap.put("k", null);                   // 显式放一个「值为 null」的条目
        String v = hashMap.get("k");
        System.out.println("  map.get(\"k\") -> " + v); // null
        System.out.println("  map.containsKey(\"k\") -> " + hashMap.containsKey("k")); // true：存在，值是 null
        System.out.println("  单线程里这两步连起来可靠：containsKey=true 说明 null 是「值为 null」；");
        System.out.println("  containsKey=false 说明 null 是「没有这个 key」。");

        System.out.println();
        System.out.println("== 2. 并发下两步复核失效 ==");
        System.out.println("  线程A: map.get(k) -> null");
        System.out.println("        （此时线程B remove(k) 或 put(k, null)... 各种交错）");
        System.out.println("  线程A: map.containsKey(k) -> false");
        System.out.println("  线程A 的结论「没有这个 key」——但 get 返回 null 的那一瞬间到底有没有？");
        System.out.println("  永远无法确认：两步之间世界变了。null 的语义在并发下不可判定。");

        System.out.println();
        System.out.println("== 3. CHM 的解法：从根上禁掉 null ==");
        Map<String, String> chm = new ConcurrentHashMap<>();
        try {
            chm.put("k", null);
        } catch (NullPointerException e) {
            System.out.println("  chm.put(\"k\", null) -> NullPointerException");
        }
        try {
            chm.put(null, "v");
        } catch (NullPointerException e) {
            System.out.println("  chm.put(null, \"v\") -> NullPointerException");
        }
        System.out.println("  null 被禁后，get 返回 null 只有一种含义：没有这个 key——二义性消灭。");
        System.out.println("  「真需要表示缺失的值」用占位对象或 Optional 包装在 value 里。");

        System.out.println();
        System.out.println("进阶：Doug Lea 的原注释——并发 map 中 (m.containsKey(k) ? m.get(k) : absent)");
        System.out.println("      不是原子快照，null 语义不可判定。HashMap 单线程下两步语义稳定。");
    }
}
