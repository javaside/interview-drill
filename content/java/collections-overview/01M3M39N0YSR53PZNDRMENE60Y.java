package com.interview.java.collections;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 题目：Comparable 和 Comparator 的区别？
 * 题卡：01M3M39N0YSR53PZNDRMENE60Y
 * 块：java/collections-overview
 *
 * 要点口径（与题卡一致）：
 *  - Comparable：类自己实现 compareTo——天生排序，一个类只有一种（String 字典序、Integer 数值）
 *  - Comparator：外部比较器——同一批对象可以有 N 种排法
 *  - 元素实现 Comparable -> sort(list)；否则 sort(list, 比较器)
 *  - Comparator 能 thenComparing 串多字段、reversed() 倒序
 */
public class ComparableVsComparatorDemo {

    /** Comparable：天生排序（按 id）——一个类只能有一种 */
    static class Employee implements Comparable<Employee> {
        final String name;
        final int age;
        final long salary;
        Employee(String name, int age, long salary) {
            this.name = name; this.age = age; this.salary = salary;
        }
        @Override
        public int compareTo(Employee o) { return Integer.compare(this.age, o.age); } // 天生按年龄
        @Override public String toString() { return name + "(" + age + "岁," + salary + "k)"; }
    }

    public static void main(String[] args) {
        List<Employee> staff = new ArrayList<>(List.of(
                new Employee("张三", 32, 25),
                new Employee("李四", 26, 30),
                new Employee("王五", 40, 22),
                new Employee("赵六", 26, 28)
        ));

        System.out.println("== 1. Comparable：天生排序（本类定义为按年龄）==");
        staff.sort(null); // 元素实现了 Comparable，直接 sort(list)
        System.out.println("  按年龄: " + staff);

        System.out.println();
        System.out.println("== 2. Comparator：外部策略，N 种排法随便换 ==");
        staff.sort(Comparator.comparingLong((Employee e) -> e.salary));
        System.out.println("  按工资: " + staff);
        staff.sort(Comparator.comparing((Employee e) -> e.name));
        System.out.println("  按姓名: " + staff);

        System.out.println();
        System.out.println("== 3. thenComparing 串多字段 + reversed 倒序 ==");
        // 主键年龄升序，同年龄按工资降序
        staff.sort(Comparator.comparingInt((Employee e) -> e.age)
                .thenComparing(Comparator.comparingLong((Employee e) -> e.salary).reversed()));
        System.out.println("  年龄升序+同年龄工资降序: " + staff);

        System.out.println();
        System.out.println("== 4. 常用组合件 ==");
        System.out.println("  Comparator.naturalOrder()  -> " + Comparator.<Integer>naturalOrder().compare(1, 2));
        System.out.println("  Comparator.reverseOrder()  -> " + Comparator.<Integer>reverseOrder().compare(1, 2));
        List<String> names = new ArrayList<>(java.util.Arrays.asList("bob", "alice", null, "carl")); // asList 允许 null（List.of 不允许）
        names.sort(Comparator.nullsFirst(Comparator.naturalOrder())); // null 排最前
        System.out.println("  nullsFirst: " + names);

        System.out.println();
        System.out.println("结论：类有唯一自然顺序 -> Comparable；多种排序策略/类不可改 -> Comparator。");
        System.out.println("进阶：约定 sgn(compare(x,y)) = -sgn(compare(y,x))、传递性；");
        System.out.println("      强烈建议 (x.compareTo(y)==0) == x.equals(y)——TreeSet/TreeMap 用 compareTo 判等，");
        System.out.println("      不一致会出现「equals 相同却共存」的排序集合怪象（见 SetVariantsDemo）。");
    }
}
