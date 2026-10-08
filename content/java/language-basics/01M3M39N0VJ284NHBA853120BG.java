package com.interview.java.languagebasics;

/**
 * 题目：== 和 equals 的区别是什么？
 * 题卡：01M3M39N0VJ284NHBA853120BG
 * 块：java/language-basics
 *
 * 要点口径（与题卡一致）：
 *  - == 对基本类型比值本身；对引用类型比是否指向同一个对象（地址）
 *  - equals 默认就是 ==（Object 实现）；类可以重写它定义「内容相同」
 *  - String、Integer 等包装类重写了 equals，比较内容而非地址
 *  - 重写 equals 必须同时重写 hashCode（契约要求）
 */
public class EqualsVsDoubleEqualsDemo {

    /** 不重写 equals 的类：equals 退化为 ==（Object 默认实现） */
    static class PlainPoint {
        final int x, y;
        PlainPoint(int x, int y) { this.x = x; this.y = y; }
    }

    /** 重写 equals（并按契约同时重写 hashCode）的类 */
    static class ValuePoint {
        final int x, y;
        ValuePoint(int x, int y) { this.x = x; this.y = y; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof ValuePoint that)) return false;
            return x == that.x && y == that.y;
        }

        @Override
        public int hashCode() {
            return 31 * x + y;
        }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 基本类型：== 比值本身 ==");
        int a = 42, b = 42;
        System.out.println("42 == 42 -> " + (a == b)); // true

        System.out.println();
        System.out.println("== 2. 引用类型：== 比是否同一个对象（地址）==");
        Object o1 = new Object();
        Object o2 = new Object();
        System.out.println("new Object() == new Object() -> " + (o1 == o2)); // false，两个对象
        System.out.println("o1 == o1 -> " + (o1 == o1));                       // true，同一个

        System.out.println();
        System.out.println("== 3. 不重写 equals 的类：equals 就是 == ==");
        PlainPoint p1 = new PlainPoint(1, 2);
        PlainPoint p2 = new PlainPoint(1, 2);
        System.out.println("内容相同但两个对象：p1.equals(p2) -> " + p1.equals(p2)); // false！

        System.out.println();
        System.out.println("== 4. 重写 equals 的类：定义「内容相同」==");
        ValuePoint v1 = new ValuePoint(1, 2);
        ValuePoint v2 = new ValuePoint(1, 2);
        System.out.println("内容相同：v1.equals(v2) -> " + v1.equals(v2)); // true
        System.out.println("但 v1 == v2 -> " + (v1 == v2));               // false，仍是两个对象

        System.out.println();
        System.out.println("== 5. String 重写了 equals（比内容）==");
        String s1 = "he" + "llo";       // 编译期常量折叠，指向常量池同一个对象
        String s2 = new String("hello"); // 显式 new，堆上新对象
        System.out.println("s1 == s2    -> " + (s1 == s2));      // false：地址不同
        System.out.println("s1.equals(s2) -> " + s1.equals(s2)); // true：内容相同

        System.out.println();
        System.out.println("结论：比较内容永远用 equals；== 比基本类型值 / 引用地址。");
        System.out.println("铁律：重写 equals 必须同时重写 hashCode（见 equalshashcode 包）。");
    }
}
