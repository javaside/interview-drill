package com.interview.java.equalshashcode;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * 题目：只重写 equals 不重写 hashCode 会发生什么？
 * 题卡：01M3M39N0YSQCVGCANWW33S0N7
 * 块：java/equals-hashcode
 *
 * 要点口径（与题卡一致）：
 *  - 症状一行流：对象放进 HashSet 后，用内容相同的新实例去 contains，返回 false
 *  - 机理：contains 按新实例的 hashCode 定桶——Object 默认 hash 是地址相关的，
 *          两个实例 hash 不同 -> 找错了桶 -> 连 equals 比对的机会都没有
 *  - 「时灵」是因为偶尔碰巧同桶，才轮到 equals 说话
 */
public class EqualsWithoutHashCodeDemo {

    /** 只重写了 equals，没重写 hashCode（事故现场） */
    static class Broken {
        final String id;
        Broken(String id) { this.id = id; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Broken b && id.equals(b.id); // 内容相同就算相等
        }
        // hashCode 没重写：Object 默认按地址
        @Override public String toString() { return "Broken(" + id + ")"; }
    }

    /** equals + hashCode 成对重写（正确姿势） */
    static class Fixed {
        final String id;
        Fixed(String id) { this.id = id; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Fixed f && id.equals(f.id);
        }
        @Override
        public int hashCode() { return Objects.hash(id); }
        @Override public String toString() { return "Fixed(" + id + ")"; }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 事故现场：只重写 equals ==");
        Set<Broken> set = new HashSet<>();
        set.add(new Broken("a1"));
        System.out.println("set.contains(new Broken(\"a1\")) -> " + set.contains(new Broken("a1"))); // false！
        System.out.println("明明 equals 说相同（" + new Broken("a1").equals(new Broken("a1")) + "），容器却说找不到。");
        System.out.println("机理：Object 默认 hash 按地址 -> 两个实例 hash 不同 -> 找错桶 ->");
        System.out.println("      连 equals 出场的机会都没有。");

        System.out.println();
        System.out.println("== 2. 「时灵时不灵」的原因 ==");
        Broken b1 = new Broken("a1");
        Broken b2 = new Broken("a1");
        System.out.println("两个不同实例的默认 hash: " + b1.hashCode() + " vs " + b2.hashCode());
        System.out.println("偶尔两个对象碰巧落进同一个桶，equals 才有机会说话——所以偶尔又能 true。");

        System.out.println();
        System.out.println("== 3. 修复：成对重写 ==");
        Set<Fixed> fixed = new HashSet<>();
        fixed.add(new Fixed("a1"));
        Fixed probe = new Fixed("a1");
        System.out.println("hash 相同: " + (fixed.iterator().next().hashCode() == probe.hashCode()));
        System.out.println("fixed.contains(probe) -> " + fixed.contains(probe)); // true

        System.out.println();
        System.out.println("结论：equals 与 hashCode 必须成对出现（record/Lombok @EqualsAndHashCode 自动成对）。");
        System.out.println("进阶：HashMap.getNode 先 (n-1)&hash 定桶，再比对 hash 与 equals。");
    }
}
