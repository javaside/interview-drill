package com.interview.java.exceptions;

/**
 * 题目：finally 的执行时机和坑？
 * 题卡：01M3M39N0ZSX6Z9F21G4KHMHHW
 * 块：java/exceptions
 *
 * 要点口径（与题卡一致）：
 *  - finally 必然执行——try 里 return、抛异常都拦不住
 *  - 顺序：return 的表达式先求值（值放一边）-> 执行 finally -> 才真正返回
 *  - 坑 1：finally 里 return 直接吞掉 try 的返回值/异常
 *  - 坑 2：finally 里抛新异常会顶替 try 的原始异常
 *  - 规矩：finally 只做清理，绝不 return、绝不再抛
 */
public class FinallyExecutionDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 必然执行：return 拦不住，异常也拦不住 ==");
        System.out.println("  正常 return 路径: " + returnsNormally());
        try {
            throwsAndFinally();
        } catch (RuntimeException e) {
            System.out.println("  异常路径: 捕获到 " + e.getMessage() + "（finally 已先执行）");
        }

        System.out.println();
        System.out.println("== 2. 时机：return 表达式【先求值】，finally 执行完才真返回 ==");
        System.out.println("  拿到: " + evaluateBeforeFinally());
        System.out.println("  （输出顺序证明：先算 getter，再跑 finally，最后方法才返回）");

        System.out.println();
        System.out.println("== 3. 坑 1：finally return 吞掉一切（详见 FinallyReturnDemo）==");
        System.out.println("  try return 1 / finally return 2 -> " + pitReturn());

        System.out.println();
        System.out.println("== 4. 坑 2：finally 抛新异常，顶替原始异常 ==");
        try {
            pitThrow();
        } catch (RuntimeException e) {
            System.out.println("  捕获到: " + e.getMessage());
            System.out.println("  ↑ 原始的「数据库连接失败」彻底丢失——排查地狱。");
        }

        System.out.println();
        System.out.println("== 5. 不执行的三种情况 ==");
        System.out.println("  ① System.exit() / halt；② JVM 崩溃（native 致命错）；");
        System.out.println("  ③ 守护线程的 finally 碰上 JVM 退出（非守护线程一结束就关机，不等它）。");

        System.out.println();
        System.out.println("规矩：finally 只做清理（关流/解锁），绝不 return、绝不再抛；");
        System.out.println("      需要自动清理用 try-with-resources（见 TryWithResourcesDemo）。");
    }

    static String returnsNormally() {
        try {
            System.out.println("    [try] 正常跑完");
            return "try 的返回值";
        } finally {
            System.out.println("    [finally] 执行了");
        }
    }

    static void throwsAndFinally() {
        try {
            throw new RuntimeException("try 里的异常");
        } finally {
            System.out.println("    [finally] 异常路径也执行了");
        }
    }

    static String evaluateBeforeFinally() {
        try {
            return getValue(); // 表达式先求值：此时打印
        } finally {
            System.out.println("    [finally] 求值之后、真正返回之前");
        }
    }

    static String getValue() {
        System.out.println("    [try] return 的表达式先求值（快照入栈）");
        return "求值时刻的值";
    }

    static int pitReturn() {
        try {
            return 1;
        } finally {
            return 2;
        }
    }

    static void pitThrow() {
        try {
            throw new RuntimeException("数据库连接失败（原始异常）");
        } finally {
            throw new RuntimeException("finally 里清理时的新异常"); // 顶替原始异常
        }
    }
}
