package com.interview.java.reflectionproxy;

import java.lang.reflect.Method;

/**
 * 题目：反射的性能开销在哪？怎么优化？
 * 题卡：01M3M39N0ZMFXRFEA8Z56QTXX6
 * 块：java/reflection-proxy
 *
 * 要点口径（与题卡一致）：
 *  - 慢在三层：查找（字符串遍历匹配，别在循环里反复找）、
 *    调用（参数装箱、类型检查、JIT 无法内联）、检查（每次访问权限检查）
 *  - 优化阶梯：缓存 Method -> setAccessible -> MethodHandle/LambdaMetafactory -> ASM 字节码
 */
public class ReflectionPerformanceDemo {

    interface Adder { int add(int a, int b); }

    static class Calc implements Adder {
        @Override public int add(int a, int b) { return a + b; }
    }

    public static void main(String[] args) throws Throwable {
        final int N = 2_000_000;
        Calc calc = new Calc();
        Adder iface = calc;

        // 反模式：每次调用都重新 getDeclaredMethod
        long t0 = System.nanoTime();
        int r1 = 0;
        for (int i = 0; i < N; i++) {
            r1 += (Integer) Calc.class.getDeclaredMethod("add", int.class, int.class).invoke(calc, i, 1);
        }
        long findEveryTime = System.nanoTime() - t0;

        // 正确姿势：缓存 Method + setAccessible
        Method cached = Calc.class.getDeclaredMethod("add", int.class, int.class);
        cached.setAccessible(true); // 顺手关掉每次调用的访问检查
        long t1 = System.nanoTime();
        int r2 = 0;
        for (int i = 0; i < N; i++) {
            r2 += (Integer) cached.invoke(calc, i, 1); // 注意：int 装箱成 Integer
        }
        long cachedCost = System.nanoTime() - t1;

        // 基线：接口直接调用（JIT 可内联）
        long t2 = System.nanoTime();
        int r3 = 0;
        for (int i = 0; i < N; i++) {
            r3 += iface.add(i, 1);
        }
        long directCost = System.nanoTime() - t2;

        System.out.println("== 1. 慢的三层（各对应一个数字来源）==");
        System.out.printf("  每次都 getDeclaredMethod : %8.1f ms（查找层：字符串遍历匹配）%n", findEveryTime / 1e6);
        System.out.printf("  缓存 Method + 关检查     : %8.1f ms（剩调用层：装箱/无法内联）%n", cachedCost / 1e6);
        System.out.printf("  接口直接调用（基线）     : %8.1f ms（JIT 看得穿，可内联）%n", directCost / 1e6);
        System.out.println("  （结果一致性: " + (r1 == r2 && r2 == r3) + "；数字是量级示意，JIT 版本不同有差异）");

        System.out.println();
        System.out.println("== 2. 优化阶梯 ==");
        System.out.println("  ① 缓存 Method 对象——别在循环里反复找（最大头的浪费）；");
        System.out.println("  ② setAccessible(true)——顺手关掉每次调用的权限检查；");
        System.out.println("  ③ 热点路径换 MethodHandle / LambdaMetafactory——可被 JIT 当普通调用优化：");
        java.lang.invoke.MethodHandle mh = java.lang.invoke.MethodHandles.lookup()
                .findVirtual(Calc.class, "add",
                        java.lang.invoke.MethodType.methodType(int.class, int.class, int.class));
        long t3 = System.nanoTime();
        int r4 = 0;
        for (int i = 0; i < N; i++) {
            r4 += (int) mh.invokeExact(calc, i, 1); // 无装箱（invokeExact 签名严格匹配）
        }
        System.out.printf("     MethodHandle.invokeExact: %8.1f ms%n", (System.nanoTime() - t3) / 1e6);
        System.out.println("  ④ 框架级：ASM 直接生成字节码（CGLIB 的 FastClass 机制：索引直呼方法）。");

        System.out.println();
        System.out.println("进阶：反射 inflation（默认 15 次后生成 GeneratedMethodAccessorN）；");
        System.out.println("      JMH 基准下现代 JIT 已把反射调用收敛到慢 1~2 倍——瓶颈常在滥用模式而非反射本身。");
    }
}
