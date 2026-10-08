package com.interview.java.languagebasics;

/**
 * 题目：方法里修改传入对象的字段，方法外的变量会跟着变吗？
 * 题卡：01M3M39N0XJS796RH2RWD0HW27
 * 块：java/language-basics
 *
 * 要点口径（与题卡一致）：
 *  - 方法拿到的是实参的副本：基本类型复制值，对象复制「地址值」
 *  - 方法内让对象参数指向新对象，不影响调用方
 *  - 方法内改对象参数的字段，调用方能看到（同一地址的同一对象）
 *  - 没有办法让方法交换两个变量的值（swap 失败是经典证据）
 */
public class PassByValueDemo {

    static class Box {
        int value;
        Box(int value) { this.value = value; }
        @Override public String toString() { return "Box(" + value + ")"; }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 基本类型：复制值本身，方法内改副本，外面毫无感觉 ==");
        int n = 10;
        changePrimitive(n);
        System.out.println("方法调用后 n = " + n); // 10，没变

        System.out.println();
        System.out.println("== 2. 对象：复制「地址值」，改字段调用方看得到（同一个对象）==");
        Box box = new Box(10);
        changeField(box);
        System.out.println("方法调用后 box = " + box); // Box(99)，变了！

        System.out.println();
        System.out.println("== 3. 对象参数重新指向新对象：只换了副本的指向，外面纹丝不动 ==");
        Box box2 = new Box(10);
        reassign(box2);
        System.out.println("方法调用后 box2 = " + box2); // Box(10)，没变

        System.out.println();
        System.out.println("== 4. 经典反证：写不出能交换两个变量的 swap ==");
        Box x = new Box(1);
        Box y = new Box(2);
        failedSwap(x, y);
        System.out.println("swap 后 x = " + x + ", y = " + y); // 还是 Box(1), Box(2)

        System.out.println();
        System.out.println("结论：Java 只有值传递。");
        System.out.println("  - 基本类型：传值的副本；对象：传地址值的副本（仍指向同一个堆对象）。");
        System.out.println("  - 「改字段可见、改指向不可见」全部由此推出；String 参数在方法内重新赋值");
        System.out.println("    外面不变，也是同一个道理（改的只是副本的指向）。");
    }

    static void changePrimitive(int p) {
        p = 999; // 改的是副本
    }

    static void changeField(Box p) {
        p.value = 99; // 副本地址指向的正是外面的同一个对象，改字段可见
    }

    static void reassign(Box p) {
        p = new Box(777); // 副本指向新对象，与调用方从此无关
    }

    static void failedSwap(Box a, Box b) {
        Box tmp = a;
        a = b;     // 只交换了两个副本的指向
        b = tmp;   // 调用方的 x、y 毫无感觉
    }
}
