package com.interview.java.equalshashcode;

import java.util.Objects;

/**
 * 题目：重写 hashCode 有什么最佳实践？
 * 题卡：01M3M39N0YWCHF3XP50BM5S57W
 * 块：java/equals-hashcode
 *
 * 要点口径（与题卡一致）：
 *  - 字段口径：hashCode 用且只用 equals 的字段——多算违约（equals 相同但 hash 不同），
 *    少算碰撞变多（不违约但变慢）
 *  - 生成器：Objects.hash(name, age) 一行搞定；record 自动生成成对实现
 *  - 缓存：不可变对象值得缓存 hash；可变对象缓存 = 自埋地雷
 *  - 分布：乘奇素数（31 惯例）逐字段累加，别自作聪明造神 hash
 */
public class HashCodeBestPracticesDemo {

    /** 实践 1：Objects.hash 一行生成 */
    static class User {
        final String name;
        final int age;
        User(String name, int age) { this.name = name; this.age = age; }

        @Override
        public boolean equals(Object o) {
            return o instanceof User u && age == u.age && name.equals(u.name);
        }
        @Override
        public int hashCode() { return Objects.hash(name, age); } // 用的字段与 equals 完全一致
        @Override public String toString() { return name + "/" + age; }
    }

    /** 实践 2：record 自动生成 equals/hashCode 成对实现（不可变） */
    record Point(int x, int y) { }

    /** 实践 3：不可变对象可缓存 hash（String 模式） */
    static final class CachedHash {
        final int x, y;
        private int hash; // 0 表示未算过；懒算 + 缓存
        CachedHash(int x, int y) { this.x = x; this.y = y; }

        @Override
        public boolean equals(Object o) {
            return o instanceof CachedHash c && x == c.x && y == c.y;
        }
        @Override
        public int hashCode() {
            if (hash == 0) hash = 31 * x + y; // 对象不可变，算一次永远有效
            return hash;
        }
    }

    public static void main(String[] args) {
        System.out.println("== 1. Objects.hash：字段口径与 equals 完全一致 ==");
        User u1 = new User("张三", 30);
        User u2 = new User("张三", 30);
        System.out.println("equals -> " + u1.equals(u2) + ", hashCode 相同 -> " + (u1.hashCode() == u2.hashCode()));

        System.out.println();
        System.out.println("== 2. record：编译器自动生成成对实现 ==");
        Point p1 = new Point(1, 2);
        Point p2 = new Point(1, 2);
        System.out.println("record equals -> " + p1.equals(p2) + ", hash 相同 -> " + (p1.hashCode() == p2.hashCode()));

        System.out.println();
        System.out.println("== 3. 不可变对象缓存 hash（String 模式）==");
        CachedHash c = new CachedHash(3, 4);
        System.out.println("两次 hashCode -> " + c.hashCode() + " / " + c.hashCode() + "（第二次读缓存）");
        System.out.println("注意：可变对象缓存 hash = 自埋地雷——改字段后缓存过期，对象在容器里失踪。");

        System.out.println();
        System.out.println("== 4. 分布：31 惯例 == result = 31*result + 字段 ==");
        int h = 1; // 经典写法：h = 1; h = 31*h + x; h = 31*h + y;
        h = 31 * h + 3;
        h = 31 * h + 4;
        System.out.println("手写 31 累加 (3,4) -> " + h);
        System.out.println("别自作聪明造「神 hash」——奇素数逐字段累加的分布已够用；");
        System.out.println("热点路径可手写 31 循环避免 Objects.hash 的 varargs 装箱开销。");

        System.out.println();
        System.out.println("== 5. 反例：多算/少算字段 ==");
        System.out.println("  多算一个 equals 不看的字段：equals 相同的两个对象 hash 不同——直接违约；");
        System.out.println("  少算一个：不违约但碰撞变多，桶里排队，容器变慢。");
        System.out.println("进阶：测试契约用 EqualsVerifier 库；boolean 可用 1231/1237，long 拆两个 32 位异或。");
    }
}
