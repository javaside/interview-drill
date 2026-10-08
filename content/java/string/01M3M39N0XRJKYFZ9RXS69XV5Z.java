package com.interview.java.string;

/**
 * 题目：String、StringBuilder、StringBuffer 怎么选？
 * 题卡：01M3M39N0XRJKYFZ9RXS69XV5Z
 * 块：java/string
 *
 * 要点口径（与题卡一致）：
 *  - String：字符串固定、拿来就用
 *  - StringBuilder：反复改（循环拼接）且单线程——可变数组，append 不产生新对象，最快
 *  - StringBuffer：与 StringBuilder 一样，只是方法全加 synchronized——多线程共享同一个拼接器才用（罕见）
 *  - 性能事故：循环里用 + 拼接，每轮 new 新 String；换 StringBuilder.append 即愈
 */
public class StringVsBuilderDemo {

    public static void main(String[] args) {
        final int N = 20_000;

        System.out.println("== 1. 循环拼接：+ vs StringBuilder（" + N + " 轮）==");
        long t0 = System.nanoTime();
        String bad = "";
        for (int i = 0; i < N; i++) {
            bad += "x"; // 每轮 new 一个新 String（旧的作废），还要拷贝越来越长的内容
        }
        long plusCost = System.nanoTime() - t0;

        long t1 = System.nanoTime();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < N; i++) {
            sb.append("x"); // 内部可变数组扩容复用，不产生新 String
        }
        String good = sb.toString();
        long sbCost = System.nanoTime() - t1;

        System.out.printf("  循环 + 拼接   : %8.2f ms%n", plusCost / 1_000_000.0);
        System.out.printf("  StringBuilder : %8.2f ms%n", sbCost / 1_000_000.0);
        System.out.println("  两者结果等长: " + (bad.length() == good.length()));
        System.out.println("  （+ 拼接每轮复制整个已有内容，总量是 O(n^2)；append 均摊 O(1)）");

        System.out.println();
        System.out.println("== 2. 单表达式拼接不用慌 ==");
        String oneShot = "a" + 1 + "b"; // javac/JIT 优化（9+ 用 invokedynamic makeConcat），无需手写 builder
        System.out.println("单表达式 \"a\"+1+\"b\" -> " + oneShot + "（编译器会优化，别过度设计）");

        System.out.println();
        System.out.println("== 3. StringBuffer：同步版 builder ==");
        StringBuilder builder = new StringBuilder();
        StringBuffer buffer = new StringBuffer();
        System.out.println("  StringBuilder.append 声明无 synchronized -> " +
                "方法上无锁（单线程最快）");
        System.out.println("  StringBuffer.append 声明 synchronized -> " +
                "方法级加锁（多线程共享同一个拼接器才值得，实际罕见）");
        buffer.append("线程安全").append("但有同步开销");
        System.out.println("  buffer 结果: " + buffer);

        System.out.println();
        System.out.println("== 4. 预估容量，避免多次扩容拷贝 ==");
        StringBuilder sized = new StringBuilder(N); // 初始容量 16，可预估传入
        System.out.println("  new StringBuilder() 初始容量 16；能预估长度就传 capacity，");
        System.out.println("  避免追加过程中的多次 (cap+1)*2 扩容与数组拷贝。");

        System.out.println();
        System.out.println("结论：固定串用 String；单线程反复拼接用 StringBuilder；多线程共享拼接器（罕见）用 StringBuffer。");
    }
}
