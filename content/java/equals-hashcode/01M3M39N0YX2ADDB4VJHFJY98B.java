package com.interview.java.equalshashcode;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 题目：equals 和 hashCode 之间的契约是什么？
 * 题卡：01M3M39N0YX2ADDB4VJHFJY98B
 * 块：java/equals-hashcode
 *
 * 要点口径（与题卡一致）：
 *  - 一条单向硬约束：equals 判定相同的两个对象，hashCode 必须相同
 *  - 反方向不要求（hash 相同是碰撞，合法，只是桶里排队）
 *  - 只重写 equals 不重写 hashCode 的典型事故：HashMap.containsKey 同内容对象返回 false
 */
public class EqualsHashCodeContractDemo {

    /** 遵守契约的实现：equals 同 -> hash 必同 */
    static class Good {
        final String id;
        Good(String id) { this.id = id; }
        @Override
        public boolean equals(Object o) { return o instanceof Good g && id.equals(g.id); }
        @Override
        public int hashCode() { return Objects.hash(id); }
        @Override public String toString() { return "Good(" + id + ")"; }
    }

    public static void main(String[] args) {
        System.out.println("契约本体：equals 相同 => hashCode 必须相同（单向硬约束）。");
        System.out.println("反方向不要求：hash 相同是碰撞，合法，只是桶里排队。");

        System.out.println();
        System.out.println("== 1. 正向：equals 相同，hash 相同 ==");
        Good g1 = new Good("k1");
        Good g2 = new Good("k1");
        System.out.println("g1.equals(g2) -> " + g1.equals(g2));
        System.out.println("g1.hashCode() == g2.hashCode() -> " + (g1.hashCode() == g2.hashCode()));

        System.out.println();
        System.out.println("== 2. 反向不要求：hash 相同但 equals 不同（碰撞）==");
        String s1 = "Aa";
        String s2 = "BB";
        System.out.println("\"Aa\".equals(\"BB\") -> " + s1.equals(s2));       // false
        System.out.println("hash 相同 -> " + (s1.hashCode() == s2.hashCode())); // true（2112，合法碰撞）
        System.out.println("HashMap 的处理：落到同一个桶，再用 equals 区分。");

        System.out.println();
        System.out.println("== 3. 违约的事故：containsKey 找不到同内容 key ==");
        Map<Good, String> map = new HashMap<>();
        map.put(new Good("k1"), "value");
        System.out.println("map.containsKey(new Good(\"k1\")) -> " + map.containsKey(new Good("k1"))); // true，契约守住
        System.out.println("若 hashCode 没成对重写（见 EqualsWithoutHashCodeDemo），这里就是 false——");
        System.out.println("明明 equals 说相同，容器说找不到：按 hash 定桶定错了，equals 没机会出场。");

        System.out.println();
        System.out.println("== 4. HashMap 查找的两步逻辑 ==");
        System.out.println("  ① (n-1) & hash 定位桶；② 桶内先比 hash，再 equals 确认。");
        System.out.println("  契约保证第①步不会把「相等的对象」分进两个桶——这就是它存在的意义。");

        System.out.println();
        System.out.println("结论：equals/hashCode 必须成对重写且用同一组字段；record 自动成对。");
        System.out.println("进阶：long 字段拆两个 32 位异或；Boolean.hashCode 用 1231/1237；HashSet 本质是 HashMap 的键集。");
    }
}
