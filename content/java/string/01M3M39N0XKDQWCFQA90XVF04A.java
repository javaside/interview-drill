package com.interview.java.string;

/**
 * 题目：String 为什么设计成不可变的？
 * 题卡：01M3M39N0XKDQWCFQA90XVF04A
 * 块：java/string
 *
 * 要点口径（与题卡一致）：
 *  - 三个红利：共享安全（字符串常量池的前提）、线程安全（零同步成本）、hashCode 可信（缓存 + 当 HashMap key）
 *  - 实现三板斧：类 final、内部字符数组私有且 final、不提供任何修改方法
 *  - 代价：频繁拼接产生中间对象，循环拼接必须用 StringBuilder
 */
public class StringImmutabilityDemo {

    public static void main(String[] args) {
        System.out.println("== 0. 现象：每次「修改」其实是造新对象 ==");
        String s = "a";
        String before = s;
        s += "b"; // 等价于 s = new StringBuilder(s).append("b").toString()，s 指向了新对象
        System.out.println("s += \"b\" 之后 before == s -> " + (before == s)); // false：旧对象没变，s 换了指向
        System.out.println("旧对象还是 \"" + before + "\"——String 一旦生成就终生不变。");

        System.out.println();
        System.out.println("== 1. 红利一：共享安全（常量池的前提）==");
        String p1 = "shared";
        String p2 = "shared";
        System.out.println("两个字面量是同一个池对象 -> " + (p1 == p2)); // true：全 JVM 只存一份
        System.out.println("敢这么复用，正因为谁也改不了它——可变字符串绝不敢放池里共享。");

        System.out.println();
        System.out.println("== 2. 红利二：线程安全 ==");
        System.out.println("不可变对象天生并发安全，零同步成本——任何线程拿到的 String 都不会");
        System.out.println("被另一个线程偷偷改掉。");

        System.out.println();
        System.out.println("== 3. 红利三：hashCode 可信 ==");
        System.out.println("hash 算一次就缓存（见 StringHashCodeDemo）；当 HashMap key 时，");
        System.out.println("key 的 hash 若会变，元素放进桶后就失踪了（见 hashmap 包的改 key 演示）。");

        System.out.println();
        System.out.println("== 4. 实现三板斧 ==");
        System.out.println("  ① 类是 final —— 不许继承绕过限制（本类无法 extends String）；");
        System.out.println("  ② 内部字符数组私有且 final —— 外面拿不到引用（Java 17 模块系统还挡反射修改）；");
        System.out.println("  ③ 不提供任何修改方法 —— replace/substring 全都返回新对象：");
        String replaced = "abc".replace('a', 'X');
        System.out.println("     \"abc\".replace('a','X') -> " + replaced + "（原串不变，拿到的是新串）");

        System.out.println();
        System.out.println("代价：频繁拼接产生中间对象。循环拼接必须用 StringBuilder（见 StringVsBuilderDemo）。");
        System.out.println("进阶：JDK 9+ 底层由 char[] 改为 byte[] + coder（LATIN1/UTF16）压缩内存。");
    }
}
