package com.interview.java.arraylist;

import java.util.ArrayList;
import java.util.List;

/**
 * 题目：ArrayList 的 remove 是怎么工作的？
 * 题卡：01M3M39N0YSKNPV9WB4ESFMHTR
 * 块：java/arraylist
 *
 * 要点口径（与题卡一致）：
 *  - remove(int index)：直接定位，把后面元素整体前移一格（数组拷贝），返回被删元素——O(n)
 *  - remove(Object o)：从头顺序 equals 找第一个匹配再删——查找 O(n) + 移动 O(n)
 *  - 重载陷阱：list.remove(1) 删的是下标 1；想删「值为 1」必须 remove(Integer.valueOf(1))
 *  - 删除 modCount++，迭代中直接删触发 fail-fast
 */
public class ArrayListRemoveDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 按下标删：后面元素整体前移一格 ==");
        List<String> list = new ArrayList<>(List.of("a", "b", "c", "d", "e"));
        String removed = list.remove(1); // 删下标 1（"b"）
        System.out.println("  remove(1) 返回 \"" + removed + "\"，剩下 " + list);
        System.out.println("  机理：c、d、e 集体往前挪一格（System.arraycopy 拷贝）——移动成本 O(n)。");

        System.out.println();
        System.out.println("== 2. 按对象删：顺序 equals 找第一个匹配 ==");
        List<String> list2 = new ArrayList<>(List.of("a", "b", "a", "c"));
        boolean changed = list2.remove("a"); // 只删第一个匹配
        System.out.println("  remove(\"a\") -> " + changed + "，剩下 " + list2);
        System.out.println("  查找 O(n)（从头 equals）+ 移动 O(n)，总账还是 O(n)。");
        System.out.println("  找不到返回 false（不抛异常）；按下标越界才抛 IndexOutOfBoundsException。");

        System.out.println();
        System.out.println("== 3. 重载陷阱：remove(1) 删的是下标不是「值 1」==");
        List<Integer> nums = new ArrayList<>(List.of(100, 1, 200));
        nums.remove(1);                          // 编译器选 remove(int)——删了下标 1（元素 1）
        System.out.println("  remove(1) 之后 -> " + nums + "（删掉了「值为 1」那个，纯属巧合撞对）");
        List<Integer> nums2 = new ArrayList<>(List.of(100, 1, 200));
        nums2.remove(Integer.valueOf(1));        // 显式装箱走 remove(Object)
        System.out.println("  remove(Integer.valueOf(1)) -> " + nums2 + "（明确删「值为 1」的元素）");
        System.out.println("  陷阱本质：remove(int) 与 remove(Object) 重载，int 字面量总是匹配前者。");

        System.out.println();
        System.out.println("== 4. 删除与 fail-fast ==");
        List<String> list3 = new ArrayList<>(List.of("a", "b", "c"));
        try {
            for (String s : list3) {
                if (s.equals("b")) list3.remove(s); // modCount 变了
            }
        } catch (java.util.ConcurrentModificationException e) {
            System.out.println("  迭代中直接 remove -> ConcurrentModificationException（详见 collections/FailFastDemo）");
        }

        System.out.println();
        System.out.println("进阶：批量删除（removeAll/removeIf）用位标记一次压缩，避免逐个前移反复拷贝；");
        System.out.println("      fastRemove 是无边界检查的内部变体（Iterator.remove 复用）。");
    }
}
