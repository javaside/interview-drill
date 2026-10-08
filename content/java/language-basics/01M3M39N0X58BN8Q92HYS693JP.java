package com.interview.java.languagebasics;

/**
 * 题目：Integer 的缓存机制是什么？
 * 题卡：01M3M39N0X58BN8Q92HYS693JP
 * 块：java/language-basics
 *
 * 要点口径（与题卡一致）：
 *  - IntegerCache 缓存 -128 到 127 的包装对象，自动装箱优先取缓存
 *  - 此范围内 == 比较碰巧为 true，范围外必定 false
 *  - new Integer(100) 永远新建对象，不走缓存（已废弃的写法）
 *  - 缓存上界可由 -XX:AutoBoxCacheMax 调大，下界固定
 */
@SuppressWarnings("deprecation")
public class IntegerCacheDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 缓存区间内：自动装箱返回同一个缓存对象 ==");
        Integer a = 100; // 编译为 Integer.valueOf(100)
        Integer b = 100;
        System.out.println("Integer a = 100, b = 100 : a == b -> " + (a == b));       // true：同一个缓存对象
        System.out.println("a.equals(b) -> " + a.equals(b));                          // true：内容相同

        System.out.println();
        System.out.println("== 2. 缓存区间外：每次装箱 new 新对象 ==");
        Integer c = 200; // 超出 [-128,127]，valueOf 每次 new
        Integer d = 200;
        System.out.println("Integer c = 200, d = 200 : c == d -> " + (c == d));       // false：地址不同！
        System.out.println("c.equals(d) -> " + c.equals(d));                          // true：内容仍相同

        System.out.println();
        System.out.println("== 3. Integer.valueOf 就是缓存的入口 ==");
        System.out.println("valueOf(127) == valueOf(127) -> " + (Integer.valueOf(127) == Integer.valueOf(127))); // true
        System.out.println("valueOf(128) == valueOf(128) -> " + (Integer.valueOf(128) == Integer.valueOf(128))); // false

        System.out.println();
        System.out.println("== 4. new Integer(100) 绕开缓存（已废弃的写法）==");
        Integer e = new Integer(100); // 永远新建对象，不走缓存
        System.out.println("new Integer(100) == Integer.valueOf(100) -> " + (e == a)); // false

        System.out.println();
        System.out.println("== 5. 一边是基本类型：发生拆箱，== 回归比值 ==");
        int f = 200;
        System.out.println("int 200 == Integer 200 -> " + (f == d)); // true：d 拆箱成 int，比值

        System.out.println();
        System.out.println("结论：包装类之间的比较永远用 equals（或保持一侧为基本类型）。");
        System.out.println("== 在 [-128,127] 内「碰巧为 true」是陷阱不是特性。");
        System.out.println("补充：缓存上界可用 JVM 参数 -XX:AutoBoxCacheMax=<n> 调大，下界固定 -128；");
        System.out.println("      Byte/Short/Long 缓存同区间（Long 不可调），Character 到 127，Float/Double 无缓存。");
    }
}
