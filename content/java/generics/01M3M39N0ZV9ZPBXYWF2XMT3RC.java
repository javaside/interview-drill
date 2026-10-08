package com.interview.java.generics;

import java.util.ArrayList;
import java.util.List;

/**
 * 题目：把 List<String> 赋给 List<Object>，编译会通过吗？
 * 题卡：01M3M39N0ZV9ZPBXYWF2XMT3RC
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - 不行，编译直接报错：List<String> 不是 List<Object> 的子类型（泛型不协变）
 *  - 假如允许：lo.add(123) 后从 List<String> 取出 Integer，类型系统自爆
 *  - 要「装各种 List」的参数用 List<?>（只读）
 *  - 对比：数组是协变的（Object[] o = strings 合法）——代价是运行时 ArrayStoreException
 */
public class GenericsInvarianceDemo {

    public static void main(String[] args) {
        List<String> strings = new ArrayList<>(List.of("a", "b"));

        System.out.println("== 1. 泛型不协变：编译直接报错 ==");
        // List<Object> lo = strings; // 编译错：incompatible types
        System.out.println("  List<Object> lo = listOfString;  // 编译报错");
        System.out.println("  表面上 String 是 Object 的子类，但容器不继承这层关系（不协变）。");
        System.out.println("  假如放行会自爆：");
        System.out.println("    lo.add(123);                      // List<Object> 里放 Integer 没毛病");
        System.out.println("    String s = listOfString.get(0);   // String 拿到 Integer —— 炸");

        System.out.println();
        System.out.println("== 2. 要「装各种 List」用 List<?>（只读）==");
        List<?> anyList = strings; // 合法：未知类型的 List，只能读
        Object first = anyList.get(0);
        System.out.println("List<?> 读出来按 Object 收 -> " + first);
        // anyList.add("x"); // 编译错：? 未知类型，写不进任何东西（除 null）

        System.out.println();
        System.out.println("== 3. 反面教材：数组是协变的 ==");
        String[] strArr = {"a", "b"};
        Object[] objArr = strArr;   // 合法！数组协变（历史遗留，泛型出现前的设计）
        System.out.println("Object[] objArr = strArr; // 编译通过（协变）");
        try {
            objArr[0] = 123;        // 编译也通过（Object 数组放 Integer 很合理）
        } catch (ArrayStoreException e) {
            System.out.println("objArr[0] = 123 -> ArrayStoreException（运行时才发现是 String[]）");
        }
        System.out.println("数组靠运行时 store check 兜底；泛型擦除后做不了这个检查，只能从编译期封死。");

        System.out.println();
        System.out.println("结论：泛型不协变是「擦除下保证类型安全」的正确选择；");
        System.out.println("      List<Object>（可写任意 Object）与 List<?>（只读）是两种不同的东西。");
    }
}
