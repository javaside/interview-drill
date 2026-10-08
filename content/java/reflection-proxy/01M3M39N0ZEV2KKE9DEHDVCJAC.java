package com.interview.java.reflectionproxy;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * 题目：反射能访问 private 成员吗？怎么访问？
 * 题卡：01M3M39N0ZEV2KKE9DEHDVCJAC
 * 块：java/reflection-proxy
 *
 * 要点口径（与题卡一致）：
 *  - 能。访问检查不是安全墙，是开关：setAccessible(true) 关闭访问检查
 *  - 框架的私有注入、JSON 读私有字段、mock 私有方法——全是这一招
 *  - 约束：Java 9 模块系统收紧边界；JDK 16+ 对 JDK 内部类默认强封装（--add-opens 放行）
 */
public class ReflectPrivateAccessDemo {

    static class Vault {
        private final String secret = "不要偷看";
        private String whisper() { return "私有方法被调用了"; }
    }

    public static void main(String[] args) throws Exception {
        Vault vault = new Vault();

        System.out.println("== 1. 直接访问：编译期就拦住 ==");
        System.out.println("  vault.secret / vault.whisper() —— private，类外编译不过。");

        System.out.println();
        System.out.println("== 2. 反射 + setAccessible：开关一关，private 照写 ==");
        Field f = Vault.class.getDeclaredField("secret");
        System.out.println("  setAccessible 之前 canAccess -> " + f.canAccess(vault)); // false
        f.setAccessible(true); // 关闭访问检查
        System.out.println("  setAccessible 之后 canAccess -> " + f.canAccess(vault)); // true
        System.out.println("  读到 private 字段: " + f.get(vault));

        Method m = Vault.class.getDeclaredMethod("whisper");
        m.setAccessible(true);
        System.out.println("  调到 private 方法: " + m.invoke(vault));

        System.out.println();
        System.out.println("== 3. 现实约束一：Java 9 模块系统 ==");
        System.out.println("  未 open 的模块拒绝深反射——自己项目里的类（无名模块）互相访问没问题，");
        System.out.println("  但跨到具名模块（JDK 内部）就要模块显式放行。");

        System.out.println();
        System.out.println("== 4. 现实约束二：JDK 16+ 对 JDK 内部类强封装 ==");
        try {
            Field value = String.class.getDeclaredField("value"); // JDK 自己的私有字段
            value.setAccessible(true); // 尝试关闭访问检查
            System.out.println("  竟然放行了（这个 JDK 配置较宽松）");
        } catch (java.lang.reflect.InaccessibleObjectException e) {
            System.out.println("  String.value 反射 -> InaccessibleObjectException");
            System.out.println("  (" + e.getMessage() + ")");
        }
        System.out.println("  这就是 --add-opens java.base/java.lang=ALL-UNNAMED 存在的原因：");
        System.out.println("  老框架/老工具深反射 JDK 内部的兼容放行口。");

        System.out.println();
        System.out.println("进阶：MethodHandles.Lookup 是更现代的替代（privateLookupIn 且目标模块 open）；");
        System.out.println("      反射有 inflation 机制（早期原生调用，默认 15 次后生成字节码类，17 起默认 no-inflation）。");
    }
}
