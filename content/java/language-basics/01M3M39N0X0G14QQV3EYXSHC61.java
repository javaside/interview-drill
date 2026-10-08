package com.interview.java.languagebasics;

/**
 * 题目：重载和重写的区别？
 * 题卡：01M3M39N0X0G14QQV3EYXSHC61
 * 块：java/language-basics
 *
 * 要点口径（与题卡一致）：
 *  - 重写 Override：子类重新实现父类/接口的同签名方法，运行时多态
 *  - 重载 Overload：同类中同名但参数列表不同的多个方法，编译期绑定
 *  - 重写要求：签名相同、权限不收窄、返回类型可协变、受检异常不扩大
 *  - 重载与返回类型无关；重写构成了动态分派的基础
 */
public class OverloadVsOverrideDemo {

    static class Animal {
        String speak() { return "动物叫"; }
        // 重载：同名不同参，编译期按参数静态选定
        String greet(Animal a) { return "greet(Animal)"; }
        String greet(Dog d)    { return "greet(Dog)"; }

        Animal speakCovariant() { return this; } // 父类版本：返回 Animal
    }

    static class Dog extends Animal {
        /** 重写：签名相同，运行时按实际类型分派 */
        @Override
        String speak() { return "汪汪"; }

        /** 重写 + 协变返回类型：返回类型可以是父类版本的子类 */
        @Override
        Dog speakCovariant() { return this; }
    }

    static class Cat extends Animal {
        @Override
        String speak() { return "喵喵"; }
    }

    public static void main(String[] args) {
        System.out.println("== 1. 重写：运行时按对象的实际类型分派（多态）==");
        Animal a1 = new Dog();
        Animal a2 = new Cat();
        System.out.println("Animal 引用指向 Dog -> " + a1.speak()); // 汪汪
        System.out.println("Animal 引用指向 Cat -> " + a2.speak()); // 喵喵

        System.out.println();
        System.out.println("== 2. 重载：编译期按参数的声明类型静态绑定 ==");
        Animal animalRef = new Dog(); // 声明类型 Animal，实际类型 Dog
        Dog dogRef = new Dog();
        Animal host = new Animal();
        System.out.println("host.greet(animalRef) -> " + host.greet(animalRef)); // greet(Animal)
        System.out.println("host.greet(dogRef)    -> " + host.greet(dogRef));    // greet(Dog)
        // ↑ 实际对象都是 Dog，但重载看编译期声明类型：animalRef 声明是 Animal 就选 greet(Animal)

        System.out.println();
        System.out.println("== 3. 重载的经典坑：null 选「最特化」的参数类型 ==");
        System.out.println("host.greet(null) -> " + host.greet(null)); // greet(Dog)：Dog 是 Animal 的子类，更特化

        System.out.println();
        System.out.println("== 4. 协变返回类型：重写可以把返回类型换成子类 ==");
        Animal onlyDog = new Dog();
        System.out.println("协变返回拿到 Dog -> " + onlyDog.speakCovariant().getClass().getSimpleName());

        System.out.println();
        System.out.println("结论：重写=纵向（子类换实现，运行时多态）；重载=横向（同名不同参，编译期选定）。");
        System.out.println("重载与返回类型无关——只有返回类型不同不构成重载，编译直接报错。");
    }
}
