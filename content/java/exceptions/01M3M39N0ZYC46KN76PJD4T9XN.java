package com.interview.java.exceptions;

/**
 * 题目：Java 异常的类层次是怎样的？
 * 题卡：01M3M39N0ZYC46KN76PJD4T9XN
 * 块：java/exceptions
 *
 * 要点口径（与题卡一致）：
 *  - Throwable 分 Error（JVM 崩了，救不了也不用救）和 Exception
 *  - Exception 分 RuntimeException（非受检：NPE/越界/ClassCastException）和其余（受检：IOException/SQLException）
 *  - 受检：编译器查岗，方法签名 throws 声明，调用者必须 try 或继续抛
 *  - 非受检：编程错误的信号，不强制处理
 */
public class ExceptionHierarchyDemo {

    /** 受检异常：签名必须声明 throws，编译器查岗 */
    static void readFile() throws java.io.IOException {
        throw new java.io.IOException("文件不存在");
    }

    public static void main(String[] args) {
        System.out.println("== 类层次 ==");
        System.out.println("Throwable");
        System.out.println(" ├─ Error                     —— JVM 崩了（OOM/StackOverflow），救不了也不用救");
        System.out.println(" └─ Exception");
        System.out.println("     ├─ RuntimeException     —— 非受检：NPE、越界、ClassCastException");
        System.out.println("     └─ 其余（IOException 等）—— 受检：编译器逼你处理");

        System.out.println();
        System.out.println("== 1. 层次关系打印 ==");
        System.out.println("  OutOfMemoryError   是 Error?     " + (Error.class.isAssignableFrom(OutOfMemoryError.class)));
        System.out.println("  StackOverflowError 是 VirtualMachineError? " + (StackOverflowError.class.getSuperclass().getSimpleName().equals("VirtualMachineError")));
        System.out.println("  NullPointerException 是 RuntimeException? " + (RuntimeException.class.isAssignableFrom(NullPointerException.class)));
        System.out.println("  IOException        是 Exception?  " + (Exception.class.isAssignableFrom(java.io.IOException.class)));
        System.out.println("  Error/Exception 都是 Throwable? " + (Throwable.class.isAssignableFrom(Error.class) && Throwable.class.isAssignableFrom(Exception.class)));

        System.out.println();
        System.out.println("== 2. 受检异常：编译器查岗 ==");
        System.out.println("  readFile() 声明 throws IOException —— 调用者不 try-catch / 不继续 throws 就编译不过：");
        System.out.println("    readFile();  // 编译错: unhandled exception: java.io.IOException");
        try {
            readFile();
        } catch (java.io.IOException e) {
            System.out.println("  捕获受检异常: " + e.getMessage());
        }

        System.out.println();
        System.out.println("== 3. 非受检异常：不强制，是编程错误的信号 ==");
        try {
            String s = null;
            s.length(); // NPE：本可避免的编程缺陷
        } catch (RuntimeException e) {
            System.out.println("  捕获非受检: " + e.getClass().getSimpleName());
        }
        System.out.println("  方法签名不用写 throws RuntimeException —— 满地 NPE 都要声明就没法看了。");

        System.out.println();
        System.out.println("== 4. 异常链：cause 保留原始案卷 ==");
        RuntimeException biz = new RuntimeException("加载配置失败", new java.io.FileNotFoundException("config.ini"));
        System.out.println("  顶层: " + biz.getMessage());
        System.out.println("  源头: " + biz.getCause());

        System.out.println();
        System.out.println("进阶：受检的设计有争议（C# 没有）；Lambda/Stream 里受检异常碍事，");
        System.out.println("      包装成 RuntimeException 抛是惯例；suppressed 由 try-with-resources 收集。");
    }
}
