package com.interview.java.exceptions;

/**
 * 题目：异常处理的最佳实践有哪些？
 * 题卡：01M3M39N0ZPY04TDHYNN09KFS7
 * 块：java/exceptions
 *
 * 要点口径（与题卡一致）—— 四条铁律：
 *  1. 不许吞：catch 空块 = 事故现场被抹掉；最起码 log 或转译后重抛
 *  2. 精确捕获：只 catch 能处理的类型；catch (Exception) 一把梭连 OOM 都吞
 *  3. 不当流程控制：构造异常要抓整个调用栈（fillInStackTrace，微秒级）
 *  4. 转译带链：底层异常包成业务异常时 cause 保留原始堆栈
 */
public class ExceptionBestPracticesDemo {

    /** 业务异常（上层能理解的语言） */
    static class ConfigLoadException extends RuntimeException {
        ConfigLoadException(String message, Throwable cause) {
            super(message, cause); // 第 4 条：cause 链保留原始案卷
        }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 不许吞：空 catch 是事故现场被抹掉 ==");
        System.out.println("  反例: try { load(); } catch (IOException e) { }   // 什么都没留下");
        System.out.println("  正解: 至少 log.error(\"读配置失败\", e)（带异常对象，别只 e.toString()），");
        System.out.println("        或转译成业务异常重抛（见第 4 条）。");

        System.out.println();
        System.out.println("== 2. 精确捕获：只 catch 你能处理的 ==");
        System.out.println("  catch (FileNotFoundException e) -> 重试/提示用户   // 能处理，OK");
        System.out.println("  catch (Exception e) 一把梭 -> 连 OOM/StackOverflow 都吞，属于灾难；");
        System.out.println("  Error（JVM 级）救不了也不用救，更不该捕。");

        System.out.println();
        System.out.println("== 3. 不当流程控制：构造异常 = 抓整个调用栈 ==");
        benchmarkExceptionAsControl();
        System.out.println("  （对比：同样判断 100 万次，普通 if 纳秒级/次，异常版微秒级/次——");
        System.out.println("    fillInStackTrace 要记录整个调用链。用它做 if-else，正常路径也被拖慢。）");

        System.out.println();
        System.out.println("== 4. 转译带链：cause 保留原始堆栈 ==");
        try {
            loadConfig();
        } catch (ConfigLoadException e) {
            System.out.println("  业务异常: " + e.getMessage());
            System.out.println("  cause:    " + e.getCause()); // 原始 IOException 还在链上
            System.out.println("  正例: new ConfigLoadException(\"读取配置失败\", e) —— 上层看业务语言，");
            System.out.println("        排障时 getCause() 仍能挖到底层案卷。");
        }

        System.out.println();
        System.out.println("进阶：JVM 参数 OmitStackTraceInFastThrow——热点路径 JIT 熔断后 NPE 不带栈，");
        System.out.println("      排障时的惊讶点；预构建静态异常实例是特殊优化手段。");
    }

    static void benchmarkExceptionAsControl() {
        final int N = 1_000_000;

        long t0 = System.nanoTime();
        int hitsIf = 0;
        for (int i = 0; i < N; i++) {
            if (i % 3 == 0) hitsIf++;
        }
        long ifCost = System.nanoTime() - t0;

        long t1 = System.nanoTime();
        int hitsEx = 0;
        for (int i = 0; i < N; i++) {
            try {
                if (i % 3 == 0) throw new IllegalStateException();
            } catch (IllegalStateException e) {
                hitsEx++;
            }
        }
        long exCost = System.nanoTime() - t1;

        System.out.printf("  if 判断   : %6.1f ms (命中 %d)%n", ifCost / 1e6, hitsIf);
        System.out.printf("  异常控制流: %6.1f ms (命中 %d)%n", exCost / 1e6, hitsEx);
        System.out.printf("  差距约 %.0f 倍%n", (double) exCost / ifCost);
    }

    static void loadConfig() {
        try {
            throw new java.io.IOException("磁盘上的 config.ini 被占用");
        } catch (java.io.IOException e) {
            throw new ConfigLoadException("读取配置失败", e); // 转译 + 带链
        }
    }
}
