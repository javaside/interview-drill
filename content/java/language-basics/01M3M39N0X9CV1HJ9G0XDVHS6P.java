package com.interview.java.languagebasics;

/**
 * 题目：final、finally、finalize 分别是什么？
 * 题卡：01M3M39N0X9CV1HJ9G0XDVHS6P
 * 块：java/language-basics
 *
 * 要点口径（与题卡一致）：
 *  - final 修饰：类不可继承 / 方法不可重写 / 变量只能赋值一次
 *  - finally：try 块的收尾，正常或异常都会执行（释放资源的固定位置）
 *  - finalize：对象被 GC 回收前的回调钩子，已废弃（Java 9+ Deprecated）
 *  - finally 不执行的三种情况：System.exit、JVM 崩溃、守护线程里的死循环
 */
public class FinalFinallyFinalizeDemo {

    /** final 类：不可继承（String 就是这么设计的） */
    static final class Sealed {
        final int value; // final 字段：只能赋值一次（构造器里完成）
        Sealed(int value) { this.value = value; }
        final int getValue() { return value; } // final 方法：子类不许重写（这里连子类都没有）
    }

    // static class Sub extends Sealed {} // 编译错：cannot inherit from final Sealed

    static class Mutable {
        int x;
        Mutable(int x) { this.x = x; }
    }

    public static void main(String[] args) {
        System.out.println("== 1. final：一次性赋值；引用不可变 ≠ 对象不可变 ==");
        final Mutable m = new Mutable(1);
        m.x = 2;                      // OK：final 锁的是引用（指向），不是对象状态
        System.out.println("final 引用改对象字段 -> x = " + m.x); // 2
        // m = new Mutable(3);        // 编译错：cannot assign a value to final variable
        System.out.println("final 变量不能再指向别的对象；final 类不可继承；final 方法不可重写。");

        System.out.println();
        System.out.println("== 2. finally：正常路径也执行，异常路径也执行 ==");
        System.out.println("  无异常路径：result = " + withFinally(false));
        try {
            System.out.println("  有异常路径：result = " + withFinally(true));
        } catch (RuntimeException e) {
            System.out.println("  有异常路径：抛出 " + e.getMessage() + "（finally 已先执行，异常继续向上传播）");
        }

        System.out.println();
        System.out.println("== 3. finally 的坑：块内 return 会「吞掉」try 的返回/异常 ==");
        System.out.println("  finally 里 return 100 -> 拿到 " + swallowedReturn()); // 100，try 的 1 被覆盖

        System.out.println();
        System.out.println("== 4. finalize：已废弃的「遗言」钩子 ==");
        System.out.println("  执行时机不确定、可能拖垮 GC、甚至能复活对象（this 逃逸）。");
        System.out.println("  Java 9 起 @Deprecated，现代替代：try-with-resources 显式 close，或 Cleaner。");
        System.out.println("  （Object.finalize 已在后续 JDK 移除，这里只讲不演示。）");

        System.out.println();
        System.out.println("== 5. finally 不执行的三种情况 ==");
        System.out.println("  ① System.exit() 直接终止 JVM；② JVM 崩溃（如 native 代码致命错）；");
        System.out.println("  ③ 守护线程里的 finally 碰上 JVM 退出——非守护线程一结束，JVM 不等守护线程的 finally。");
    }

    static String withFinally(boolean boom) {
        try {
            if (boom) throw new RuntimeException("出错了");
            return "try 正常返回";
        } finally {
            System.out.println("  [finally 执行了] boom=" + boom);
        }
    }

    static int swallowedReturn() {
        try {
            return 1; // 会被 finally 的 return 覆盖（反模式，别这么写）
        } finally {
            return 100;
        }
    }
}
