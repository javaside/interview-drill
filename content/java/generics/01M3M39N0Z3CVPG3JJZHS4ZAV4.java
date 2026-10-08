package com.interview.java.generics;

import java.lang.reflect.Array;
import java.util.function.IntFunction;
import java.util.function.Supplier;

/**
 * 题目：为什么不能 new T()、new T[]？
 * 题卡：01M3M39N0Z3CVPG3JJZHS4ZAV4
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - T 编译完就没了（变成 Object），运行时不知道 T 是谁——new T() 无从下手
 *  - 绕路一：传 Class<T>，内部 getDeclaredConstructor().newInstance()；数组用 Array.newInstance
 *  - 绕路二：传工厂 Supplier<T> / IntFunction<T[]>（如 toArray(String[]::new)）
 */
public class CannotNewTDemo {

    static class Factory<T> {
        // private T field = new T();   // 编译错：Type parameter 'T' cannot be instantiated directly
        // private T[] arr = new T[10]; // 编译错：不能创建类型参数的数组

        /** 绕路一：Class<T> 泛型令牌 —— 运行时类型凭证 */
        private final Class<T> type;
        Factory(Class<T> type) { this.type = type; }

        T create() throws Exception {
            return type.getDeclaredConstructor().newInstance();
        }

        @SuppressWarnings("unchecked")
        T[] createArray(int len) {
            return (T[]) Array.newInstance(type, len); // Array.newInstance 返回 Object，强转
        }
    }

    /** 绕路二：工厂（现代 API 常见姿势） */
    static <T> T create(Supplier<T> factory) {
        return factory.get();
    }

    static class Point {
        int x, y;
        Point() { } // 无参构造器：Class<T> 反射路线的入口
        @Override public String toString() { return "Point(" + x + "," + y + ")"; }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("== 0. 为什么不行？==");
        System.out.println("  T 编译完就擦掉了（变 Object），运行时不知道 T 是谁——");
        System.out.println("  new T() 无从下手（万一 T 是抽象类呢？）。new T[] 同理，");
        System.out.println("  而且数组要运行时做 store check，擦除后做不到。");

        System.out.println();
        System.out.println("== 1. 绕路一：传 Class<T> ==");
        Factory<Point> pf = new Factory<>(Point.class);
        Point p = pf.create();
        System.out.println("Class<T> 创建实例 -> " + p + " 类似: " + p.getClass().getSimpleName());
        Point[] arr = pf.createArray(3);
        arr[0] = new Point();
        arr[0].x = 1; arr[0].y = 2;
        System.out.println("Array.newInstance 创建数组 -> " + arr.getClass().getComponentType().getSimpleName() + "[" + arr.length + "]");

        System.out.println();
        System.out.println("== 2. 绕路二：传工厂 ==");
        String s = create(() -> "工厂造的串");
        System.out.println("Supplier<T> 创建 -> " + s);
        // JDK 里的例子：toArray(IntFunction<T[]>) 接收 String[]::new 这种数组构造引用
        String[] copied = java.util.List.of("a", "b").toArray(String[]::new);
        System.out.println("toArray(String[]::new) -> 长度 " + copied.length);

        System.out.println();
        System.out.println("结论：要运行时创建 T，就得把运行时类型信息「随身带过来」：");
        System.out.println("  - Class<T>（类型令牌）/ Array.newInstance（数组）；");
        System.out.println("  - Supplier<T> / IntFunction<T[]>（工厂引用）。");
        System.out.println("进阶：匿名子类可捕获完整泛型参数（超类型令牌 TypeToken/TypeReference），Jackson/Guice 的基础。");
    }
}
