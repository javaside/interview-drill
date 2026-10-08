package com.interview.java.generics;

import java.util.ArrayList;
import java.util.List;

/**
 * 题目：通配符 ? extends 和 ? super 怎么用？
 * 题卡：01M3M39N0ZAM96P346K7E77E44
 * 块：java/generics
 *
 * 要点口径（与题卡一致）：
 *  - PECS 口诀（Producer-Extends, Consumer-Super）
 *  - ? extends T：它是生产者，只读——读出来统一按 T 收货，不能 add
 *  - ? super T：它是消费者，只写——写 T 没毛病；读出来只能当 Object
 *  - 一句话：extends 读、super 写；不确定时用精确类型
 */
public class PecsWildcardDemo {

    public static void main(String[] args) {
        List<Integer> ints = new ArrayList<>(List.of(1, 2, 3));
        List<Double> doubles = new ArrayList<>(List.of(1.5, 2.5));

        System.out.println("== 1. ? extends Number：生产者，只读 ==");
        List<? extends Number> producer = ints; // 背后可能是 List<Integer>，也可能是 List<Double>
        Number n = producer.get(0);             // 读：统一按 Number 收货，安全
        System.out.println("读出来按 Number 收 -> " + n);
        // producer.add(42);      // 编译错：不能 add
        // 原因：它背后若是 List<Double>，add 进去的 Integer 就是异物——编译器直接封死写操作
        System.out.println("写：producer.add(...) 编译报错——背后类型未知，写什么都可能是异物。");

        System.out.println();
        System.out.println("== 2. ? super Integer：消费者，只写 ==");
        List<Number> numbers = new ArrayList<>();
        List<? super Integer> consumer = numbers; // 背后可能是 List<Number>、List<Object>
        consumer.add(42);                          // 写 Integer 没毛病：Integer 一定是 Number/Object
        System.out.println("写：consumer.add(42) OK -> 底层 List<Number> = " + numbers);
        Object readBack = consumer.get(0);         // 读：只能当 Object
        System.out.println("读：只能当 Object 拿到 -> " + readBack);

        System.out.println();
        System.out.println("== 3. PECS 教科书签名：Collections.copy ==");
        // public static <T> void copy(List<? super T> dest, List<? extends T> src)
        List<Number> dest = new ArrayList<>(List.of(0d, 0d, 0d));
        java.util.Collections.copy(dest, List.of(1, 2, 3)); // dest 是消费者（super），src 是生产者（extends）
        System.out.println("copy(dest=List<Number>, src=List<Integer>) -> " + dest);

        System.out.println();
        System.out.println("结论：extends 读、super 写（PECS）；<?> 即 ? extends Object（啥都读不了保证，啥都写不进）；");
        System.out.println("      对比：数组是协变的（Object[] o = strings 合法），代价是运行时 ArrayStoreException");
        System.out.println("      ——这正是泛型不协变要修的历史伤（见 GenericsInvarianceDemo）。");
    }
}
