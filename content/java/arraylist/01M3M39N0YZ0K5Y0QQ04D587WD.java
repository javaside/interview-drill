package com.interview.java.arraylist;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 题目：对 Arrays.asList 返回的 List 调用 add 会成功吗？
 * 题卡：01M3M39N0YZ0K5Y0QQ04D587WD
 * 块：java/arraylist
 *
 * 要点口径（与题卡一致）：
 *  - Arrays.asList(arr) 是原数组的定长视图
 *  - set(i,x) 可以——改的就是原数组那个位置（共享数据）
 *  - add/remove 炸 UnsupportedOperationException——长度锁死
 *  - 要可变列表：new ArrayList<>(Arrays.asList(arr))；List.of 连 set 都不许
 *  - 坑：asList(int[]) 得到 List<int[]>（长度 1）
 */
public class ArraysAsListDemo {

    public static void main(String[] args) {
        System.out.println("== 1. add：直接炸 ==");
        String[] arr = {"a", "b", "c"};
        List<String> view = Arrays.asList(arr);
        try {
            view.add("d");
        } catch (UnsupportedOperationException e) {
            System.out.println("  view.add(\"d\") -> UnsupportedOperationException（定长，没有扩容机制）");
        }
        try {
            view.remove(0);
        } catch (UnsupportedOperationException e) {
            System.out.println("  view.remove(0) -> 同样 UnsupportedOperationException");
        }

        System.out.println();
        System.out.println("== 2. set：可以，而且写回原数组 ==");
        view.set(0, "X");
        System.out.println("  view.set(0,\"X\") 后：view=" + view);
        System.out.println("  原数组 arr = " + Arrays.toString(arr) + " ← 同一份数据，改视图就是改数组");

        System.out.println();
        System.out.println("== 3. 要真正可变：拷贝一份 ==");
        List<String> mutable = new ArrayList<>(Arrays.asList(arr)); // 拷贝，解除与数组的绑定
        mutable.add("d");
        System.out.println("  new ArrayList<>(asList(arr)) 后 add -> " + mutable + "，原数组不变："
                + Arrays.toString(arr));

        System.out.println();
        System.out.println("== 4. List.of 更狠：连 set 都不许 ==");
        List<String> of = List.of("a", "b");
        try {
            of.set(0, "X");
        } catch (UnsupportedOperationException e) {
            System.out.println("  List.of(...).set(...) -> UnsupportedOperationException（完全不可变）");
        }
        System.out.println("  另注意：List.of 不接受 null 元素（立刻 NPE）。");

        System.out.println();
        System.out.println("== 5. 基本类型数组的坑 ==");
        int[] ints = {1, 2, 3};
        List<int[]> weird = Arrays.asList(ints); // 泛型只对引用类型：整个 int[] 被当成一个元素
        System.out.println("  Arrays.asList(int[]).size() -> " + weird.size() + "（不是 3！）");
        Integer[] boxed = {1, 2, 3};
        List<Integer> right = Arrays.asList(boxed); // 装箱只对引用类型数组发生
        System.out.println("  Arrays.asList(Integer[]).size() -> " + right.size());
    }
}
