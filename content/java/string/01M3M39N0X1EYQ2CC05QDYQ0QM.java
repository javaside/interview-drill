package com.interview.java.string;

/**
 * 题目：String s = new String("abc") 会创建几个对象？
 * 题卡：01M3M39N0X1EYQ2CC05QDYQ0QM
 * 块：java/string
 *
 * 要点口径（与题卡一致）：
 *  - "abc" 字面量：类加载时常量池没有就在池里放一个
 *  - new String(...)：在堆里再造一个全新对象
 *  - 答案：常量池已有 -> 1 个（只有堆对象）；没有 -> 2 个（池 + 堆）
 *  - intern() 可换取池内引用（池没有则登记入池）
 */
public class NewStringObjectsDemo {

    public static void main(String[] args) {
        System.out.println("拆开看这行代码的两步：");
        System.out.println("  1. \"abc\" 字面量 —— 类加载时若常量池还没有，就在池里放一个；");
        System.out.println("  2. new String(...) —— 在堆里再造一个全新对象（内容拷贝一份）。");
        System.out.println();
        System.out.println("答案：常量池已有 \"abc\" -> 1 个（只有堆对象）；没有 -> 2 个（池 + 堆）。");

        System.out.println();
        System.out.println("== 演示 1：堆对象与池对象不是同一个 ==");
        String heap = new String("abc"); // 堆里新对象（假设池里已有 "abc"）
        String pool = "abc";             // 取池里的那个
        System.out.println("new String(\"abc\") == \"abc\" -> " + (heap == pool)); // false：堆 vs 池
        System.out.println("heap.equals(pool) -> " + heap.equals(pool));          // true：内容相同

        System.out.println();
        System.out.println("== 演示 2：intern() 主动换取池内引用 ==");
        String interned = heap.intern();
        System.out.println("heap.intern() == \"abc\" -> " + (interned == pool)); // true：拿到的是池里那个
        System.out.println("intern 的语义：池里有就返回池引用，没有就把这个对象登记入池再返回。");

        System.out.println();
        System.out.println("== 演示 3：动态拼接的串默认不入池 ==");
        String dynamic = "ab" + getString(); // 运行期才能确定，编译期不折叠、也不入池
        System.out.println("动态串 == 字面量 -> " + (dynamic == "abc"));   // false
        System.out.println("动态串.intern() == 字面量 -> " + (dynamic.intern() == "abc")); // true

        System.out.println();
        System.out.println("进阶：字面量在类加载的常量池解析阶段 intern；invokedynamic 拼接的动态串默认不入池；");
        System.out.println("      intern 在 JDK 7+ 位于本地堆而非 PermGen。== 判断池引用仅作理解，生产禁用。");
    }

    static String getString() {
        return "c";
    }
}
