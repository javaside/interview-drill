package com.interview.java.generics;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

/**
 * 题目：什么是类型擦除？
 * 题卡：01M3M39N0YNEJ902KWVMJ0XVSJ
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - List<String> 和 List<Integer> 运行时是同一个类——泛型只活在编译期
 *  - 无边界 <T> 擦成 Object；<T extends Number> 擦成 Number
 *  - list.get(0) 的类型安全是编译器补的 checkcast（强制转换）
 *  - 运行时反射只看得到原始类型 List
 */
public class TypeErasureDemo {

    static class Box<T> {
        T value; // 无边界 T：编译后字段类型就是 Object
        T get() { return value; }
    }

    static class NumBox<T extends Number> {
        T value; // 有边界 T：编译后字段类型是 Number
    }

    public static void main(String[] args) throws Exception {
        System.out.println("== 1. 运行时是同一个类 ==");
        List<String> strings = new ArrayList<>();
        List<Integer> ints = new ArrayList<>();
        System.out.println("List<String>.getClass() == List<Integer>.getClass() -> "
                + (strings.getClass() == ints.getClass())); // true！泛型参数在运行时不存在

        System.out.println();
        System.out.println("== 2. 擦除后 T 变成什么？反射看字段声明类型 ==");
        Field f = Box.class.getDeclaredField("value");
        System.out.println("Box<T> 的 T 字段擦除后类型 -> " + f.getType().getName());       // java.lang.Object
        Field f2 = NumBox.class.getDeclaredField("value");
        System.out.println("NumBox<T extends Number> 的 T 字段擦除后类型 -> " + f2.getType().getName()); // java.lang.Number

        System.out.println();
        System.out.println("== 3. 编译器补的 checkcast：取值时自动强转 ==");
        Box<String> box = new Box<>();
        box.value = "hello";
        // javac 生成的指令等价于：String s = (String) box.get(); —— 类型安全是一处处守出来的
        String s = box.get();
        System.out.println("box.get() 拿到 -> " + s + "（编译器在调用点插入了到 String 的强转）");

        System.out.println();
        System.out.println("== 4. 原始类型的「裸奔」：绕过编译器检查 ==");
        List<String> raw = new ArrayList<>();
        List liar = raw;        // 原始类型：泛型检查被绕过
        liar.add(123);          // 编译器只给警告（unchecked），运行时不报错——List 里没有 Integer 这回事
        try {
            String boom = raw.get(0); // checkcast 在这里爆炸
            System.out.println("不该走到这: " + boom);
        } catch (ClassCastException e) {
            System.out.println("raw.get(0) 转 String -> ClassCastException: " + e.getMessage());
            System.out.println("泛型的安全完全靠编译期把关，绕过它就要自己承担运行时炸雷。");
        }

        System.out.println();
        System.out.println("进阶：字节码的 signature 属性保留了泛型信息（getGenericType 可读），");
        System.out.println("      但 JVM 指令层无泛型；桥方法维持多态（见 BridgeMethodDemo）。");
    }
}
