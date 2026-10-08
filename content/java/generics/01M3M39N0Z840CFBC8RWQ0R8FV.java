package com.interview.java.generics;

import java.lang.reflect.Method;
import java.util.Comparator;
import java.util.List;

/**
 * 题目：什么是桥方法？
 * 题卡：01M3M39N0Z840CFBC8RWQ0R8FV
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - 擦除让父/子方法签名对不上，编译器默默补一个 synthetic bridge 方法
 *  - 桥里强转参数后转调你的具体版本——擦除世界的多态胶水
 *  - 反射遍历方法列表（isBridge 标记）能看到它
 */
public class BridgeMethodDemo {

    interface StringComparator extends Comparator<String> { }

    /** 你写的实现：compare(String, String) —— 但接口擦除后声明的是 compare(Object, Object) */
    static class ByLength implements Comparator<String> {
        @Override
        public int compare(String a, String b) {
            return Integer.compare(a.length(), b.length());
        }
    }

    /** 协变返回类型也会生成桥：父类返回 Object，子类返回 String */
    static class Supplier {
        Object supply() { return "parent"; }
    }
    static class StringSupplier extends Supplier {
        @Override
        String supply() { return "child"; }
        // 编译器补：Object supply() { return supply(); /* 转发到 String 版 */ }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 多态为什么没被擦除炸掉？==");
        Comparator<String> cmp = new ByLength(); // 接口引用（声明类型是擦除后的 compare(Object,Object)）
        System.out.println("按长度比较 \"bbb\" vs \"aa\" -> " + cmp.compare("bbb", "aa"));
        System.out.println("接口声明 compare(Object,Object)，你写的是 compare(String,String)——");
        System.out.println("签名对不上，编译器补了个桥方法在中间转发。");

        System.out.println();
        System.out.println("== 2. 反射看到桥方法 ==");
        for (Method m : ByLength.class.getDeclaredMethods()) {
            System.out.printf("  %-40s bridge=%-5s synthetic=%s%n",
                    m.getName() + "(" + paramTypes(m) + ")", m.isBridge(), m.isSynthetic());
        }
        // 输出里除 compare(String,String) 外还有一个 compare(Object,Object)：
        // 方法体是 { return compare((String)a, (String)b); } —— 这就是桥

        System.out.println();
        System.out.println("== 3. 协变返回类型也靠桥 ==");
        for (Method m : StringSupplier.class.getDeclaredMethods()) {
            System.out.printf("  %-30s bridge=%-5s 返回 %s%n",
                    m.getName() + "()", m.isBridge(), m.getReturnType().getSimpleName());
        }
        Supplier poly = new StringSupplier();
        System.out.println("父类引用调 supply() -> " + poly.supply()); // child：落在桥上，桥转调 String 版

        System.out.println();
        System.out.println("结论：桥方法是编译器生成的合成方法（synthetic + bridge 标记），");
        System.out.println("      作用是在擦除后的世界里维持多态转调。");
        System.out.println("进阶：AOP/反射按方法名找方法时要过滤 isBridge()，否则同一逻辑被重复触发。");
        System.out.println("      （JDK 的 List.of 排序示例：");
        List<String> sorted = new java.util.ArrayList<>(List.of("bbb", "a", "cc"));
        sorted.sort(new ByLength());
        System.out.println("      " + sorted + "）");
    }

    static String paramTypes(Method m) {
        StringBuilder sb = new StringBuilder();
        Class<?>[] ps = m.getParameterTypes();
        for (int i = 0; i < ps.length; i++) {
            if (i > 0) sb.append(", ");
            sb.append(ps[i].getSimpleName());
        }
        return sb.toString();
    }
}
