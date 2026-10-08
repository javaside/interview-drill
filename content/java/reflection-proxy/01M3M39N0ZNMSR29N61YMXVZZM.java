package com.interview.java.reflectionproxy;

/**
 * 题目：获取 Class 对象的方式有哪些？
 * 题卡：01M3M39N0ZNMSR29N61YMXVZZM
 * 块：java/reflection-proxy
 *
 * 要点口径（与题卡一致）：
 *  - String.class：写代码时就知道类型，静态最省
 *  - s.getClass()：手上有实例，问它是谁（多态下是真实类）
 *  - Class.forName("全限定名")：只有字符串名字，运行时加载（JDBC 老式驱动注册）
 *  - 三种方式对同一个类拿到的是同一份 Class（JVM 每类只一份）
 */
public class GetClassWaysDemo {

    static class Animal { }
    static class Dog extends Animal { }

    public static void main(String[] args) throws ClassNotFoundException {
        System.out.println("== 1. 三条路 ==");
        // 路 1：类字面量（编译期已知）
        Class<String> byLiteral = String.class;
        // 路 2：实例的 getClass()（运行时问真实类型）
        String s = "hello";
        Class<?> byInstance = s.getClass();
        // 路 3：Class.forName 全限定名（只有字符串）
        Class<?> byName = Class.forName("java.lang.String");

        System.out.println("  String.class        -> " + byLiteral.getName());
        System.out.println("  \"hello\".getClass()  -> " + byInstance.getName());
        System.out.println("  Class.forName(...)  -> " + byName.getName());

        System.out.println();
        System.out.println("== 2. 同一个类，全 JVM 只有一份 Class ==");
        System.out.println("  三种方式拿到同一份 -> " + (byLiteral == byInstance && byInstance == byName));
        System.out.println("  synchronized(String.class) 锁的就是这个对象；");
        System.out.println("  static 变量存在 Class 对象管辖的元空间/堆区。");

        System.out.println();
        System.out.println("== 3. getClass() 在多态下问的是「真实类」==");
        Animal a = new Dog();
        System.out.println("  声明类型 Animal，实际对象 Dog：");
        System.out.println("  a.getClass().getSimpleName() -> " + a.getClass().getSimpleName()); // Dog
        System.out.println("  对比 getClass() != Animal.class -> " + (a.getClass() != Animal.class));

        System.out.println();
        System.out.println("== 4. forName 的用途与细节 ==");
        Class<?> driver = Class.forName("com.interview.java.reflectionproxy.GetClassWaysDemo");
        System.out.println("  老式 JDBC: Class.forName(\"com.mysql.cj.jdbc.Driver\") —— 触发驱动静态块注册自己");
        System.out.println("  双参重载 forName(name, false, loader)：initialize=false 只加载不跑静态块。");

        System.out.println();
        System.out.println("进阶：类加载器委派下同一个类名可能有多份 Class（不同 loader）——Web 容器类隔离的基础；");
        System.out.println("      getCanonicalName 与 getName 在内部类/数组上输出不同。");
    }
}
