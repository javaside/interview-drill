package com.interview.java.arraylist;

import java.util.ArrayList;
import java.util.List;

/**
 * 题目：subList 返回的是什么？
 * 题卡：01M3M39N0Y0TJ3PKJPN01HQXKA
 * 块：java/arraylist
 *
 * 要点口径（与题卡一致）：
 *  - subList(2,5) 拿到的不是新列表，是原列表的「窗口」（视图）：同一份数据，不拷贝
 *  - 视图上的结构性修改（增删）会直接打到原列表
 *  - 原列表此后被结构性修改，视图立刻作废——再碰就是 ConcurrentModificationException
 *  - 需持久化就 new ArrayList<>(subList) 拷贝快照
 */
public class SubListDemo {

    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));

        System.out.println("== 1. 视图：底层同一份数据，不拷贝 ==");
        List<Integer> view = list.subList(2, 5); // [2,3,4]
        System.out.println("  subList(2,5) -> " + view);
        view.set(0, 99); // 非结构性修改（set）
        System.out.println("  view.set(0,99) 后原列表 -> " + list); // 原列表也变了：同一份数据

        System.out.println();
        System.out.println("== 2. 视图上的结构性修改直接打到原列表 ==");
        List<Integer> list2 = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));
        List<Integer> view2 = list2.subList(2, 5);
        view2.remove(0); // 删的是原列表的元素！
        System.out.println("  view2.remove(0) 后：view2=" + view2 + ", 原列表=" + list2);

        System.out.println();
        System.out.println("== 3. 原列表动了结构，视图立刻作废 ==");
        List<Integer> list3 = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));
        List<Integer> view3 = list3.subList(2, 5);
        list3.add(6); // 原列表结构性修改
        try {
            System.out.println("  还想用视图: " + view3.size());
        } catch (java.util.ConcurrentModificationException e) {
            System.out.println("  view3.size() -> ConcurrentModificationException（视图已作废）");
        }
        System.out.println("  机理：SubList 持有 parent 引用与 offset/size，modCount 对账与 fail-fast 同源。");

        System.out.println();
        System.out.println("== 4. 要持久化就拷贝快照 ==");
        List<Integer> list4 = new ArrayList<>(List.of(0, 1, 2, 3, 4, 5));
        List<Integer> snapshot = new ArrayList<>(list4.subList(2, 5)); // 拷贝一份
        list4.add(6);  // 原列表随便动
        System.out.println("  拷贝的快照不受影响: " + snapshot);
        System.out.println("  JDK 指南：subList 结果只作临时遍历/局部操作。");
    }
}
