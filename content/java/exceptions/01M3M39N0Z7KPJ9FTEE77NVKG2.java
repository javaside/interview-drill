package com.interview.java.exceptions;

/**
 * 题目：try-with-resources 是怎么工作的？
 * 题卡：01M3M39N0Z7KPJ9FTEE77NVKG2
 * 块：java/exceptions
 *
 * 要点口径（与题卡一致）：
 *  - 资源在 try(...) 括号里声明，编译器自动生成「逆序 close + 判空」
 *  - Java 9 起括号里可直接放外面已有的 effectively final 变量
 *  - 异常不互吞：主体异常为主，close 的异常挂进 getSuppressed()
 */
public class TryWithResourcesDemo {

    static class Resource implements AutoCloseable {
        final String name;
        Resource(String name) {
            this.name = name;
            System.out.println("  [打开] " + name);
        }
        void work(boolean boom) {
            if (boom) throw new RuntimeException(name + " 干活时出事了");
            System.out.println("  [使用] " + name);
        }
        @Override
        public void close() {
            System.out.println("  [关闭] " + name);
        }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 老写法的苦难 ==");
        System.out.println("  InputStream in = null; try { ... } finally { if (in != null) in.close(); }");
        System.out.println("  ——啰嗦，close 本身还抛受检异常，还得再包一层 try。");

        System.out.println();
        System.out.println("== 2. try-with-resources：先开后关（逆序 close）==");
        try (Resource a = new Resource("A"); Resource b = new Resource("B")) {
            a.work(false);
            b.work(false);
        } // 编译器生成：先关 B 再关 A，各判空
        System.out.println("  （注意输出顺序：打开 A、B；关闭 B、A——逆序）");

        System.out.println();
        System.out.println("== 3. 异常不互吞：主体异常为主，close 的进 suppressed ==");
        try (Resource c = new Resource("C")) {
            c.work(true); // 主体抛异常
        } catch (RuntimeException e) {
            System.out.println("  捕获主异常: " + e.getMessage());
            // 如果 close 也抛异常，那个异常会挂到 e.getSuppressed() 里，而不是顶替主异常
        }

        System.out.println();
        System.out.println("== 4. suppressed 演示：主体和 close 同时炸 ==");
        try (Resource d = new Resource("D")) {
            d.work(true);
        } catch (RuntimeException e) {
            System.out.println("  主异常: " + e.getMessage());
            System.out.println("  suppressed 数量: " + e.getSuppressed().length);
            for (Throwable s : e.getSuppressed()) {
                System.out.println("  suppressed: " + s.getMessage());
            }
        }
        // 让 close 也抛一次：
        try (AutoCloseable bad = () -> { throw new RuntimeException("close 时也出事"); }) {
            throw new RuntimeException("主体出事");
        } catch (Exception e) {
            System.out.println("  [close 也抛] 主异常: " + e.getMessage() + ", suppressed[0]: " + e.getSuppressed()[0].getMessage());
        }

        System.out.println();
        System.out.println("== 5. Java 9+：括号里直接放外面的 effectively final 变量 ==");
        try (Resource ef = new Resource("E")) {
            Resource kept = ef; // 只要不重新赋值
            kept.work(false);
        }
        Resource outer = new Resource("F");
        try (outer) { // Java 9 起合法：outer 从未重新赋值（effectively final）
            outer.work(false);
        }
        System.out.println("  要求「从未重新赋值」：编译器要把变量抄进自动关闭逻辑，");
        System.out.println("  你中途换指向，它就不知道该关哪个了。");
    }
}
