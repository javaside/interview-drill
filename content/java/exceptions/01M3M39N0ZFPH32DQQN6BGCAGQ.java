package com.interview.java.exceptions;

/**
 * 题目：finally 里 return，方法返回什么？
 * 题卡：01M3M39N0ZFPH32DQQN6BGCAGQ
 * 块：java/exceptions
 *
 * 要点口径（与题卡一致）：
 *  - 答案：finally 说了算——try return 1、finally return 2，方法返回 2
 *  - try 抛异常而 finally return？异常被吞，照样返回 2
 *  - 机理：返回值是栈上的快照，finally 的 return 走另一条退出路径，直接改写结局
 *  - 阿里 Java 手册明令禁止：它会静默吃掉异常与返回值
 */
public class FinallyReturnDemo {

    public static void main(String[] args) {
        System.out.println("== 1. try return 1, finally return 2 -> 拿到什么？==");
        System.out.println("  result = " + tryReturnFinallyReturn()); // 2

        System.out.println();
        System.out.println("== 2. try 抛异常, finally return -> 异常去哪了？==");
        System.out.println("  result = " + swallowExceptionByReturn()); // 2
        System.out.println("  ↑ try 的异常凭空消失，调用方毫无感知——没有任何 catch 到它。");

        System.out.println();
        System.out.println("== 3. finally 不 return，只改返回值变量 -> 无效 ==");
        System.out.println("  result = " + finallyModifyVariable()); // 1！
        System.out.println("  机理：return 的表达式【先求值】放到栈上（快照=1），执行 finally，");
        System.out.println("  然后把快照返回——finally 里改局部变量改的是变量，不是那份快照。");

        System.out.println();
        System.out.println("== 4. 对照：finally 不掺和 return 时一切正常 ==");
        try {
            int r = normalFlow();
            System.out.println("  result = " + r + "（异常也被正常抛出/捕获）");
        } catch (RuntimeException e) {
            System.out.println("  捕获到: " + e.getMessage());
        }

        System.out.println();
        System.out.println("机理总结：finally 的 return/throw 是【另一条退出路径】，直接改写结局；");
        System.out.println("  JLS 14.20.2 定义精确语义，字节码里 finally-return 分支覆盖返回槽。");
        System.out.println("  这是《阿里 Java 手册》明令禁止的写法——不是不工作，是静默吃掉异常与返回值，");
        System.out.println("  让排障变成玄学。规矩：finally 只做清理，绝不 return、绝不再抛。");
    }

    static int tryReturnFinallyReturn() {
        try {
            return 1;
        } finally {
            return 2; // finally 赢
        }
    }

    static int swallowExceptionByReturn() {
        try {
            throw new RuntimeException("try 里的异常");
        } finally {
            return 2; // 异常被吞，返回 2
        }
    }

    static int finallyModifyVariable() {
        int x = 1;
        try {
            return x; // 此刻 x=1 已快照到栈上
        } finally {
            x = 99;   // 改的是变量，改不了快照
        }
    }

    static int normalFlow() {
        try {
            throw new RuntimeException("正常抛出的异常");
        } finally {
            // 只做清理，不碰控制流
        }
    }
}
