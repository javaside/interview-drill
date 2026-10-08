package com.interview.java.collections;

import java.util.*;

/**
 * 题目：Java 集合框架的整体结构是怎样的？
 * 题卡：01M3M39N0Y9TXHK3XYMAC70KFA
 * 块：java/collections-overview
 *
 * 要点口径（与题卡一致）：
 *  - Collection（单值族）：List（有序可重复）/ Set（不可重复）/ Queue（排队语义）
 *  - Map（键值族）：独立接口，不继承 Collection
 *  - 选型三问：要不要重复？要不要键值对？要不要有序/排序？
 *  - Vector/Hashtable 是遗留同步类（全方法 synchronized），新代码用并发包对应物
 */
public class CollectionFrameworkDemo {

    public static void main(String[] args) {
        System.out.println("== 族谱图 ==");
        System.out.println("Collection（装一个一个的东西）");
        System.out.println(" ├─ List：有序、可重复（ArrayList / LinkedList / Vector）");
        System.out.println(" ├─ Set：不可重复（HashSet / LinkedHashSet / TreeSet）");
        System.out.println(" └─ Queue：排队语义（ArrayDeque / PriorityQueue）");
        System.out.println("Map（装键值对）—— 独立接口，不继承 Collection");
        System.out.println(" └─ HashMap / LinkedHashMap / TreeMap / Hashtable");

        System.out.println();
        System.out.println("== 1. 接口关系打印 ==");
        System.out.println("  ArrayList 是 List?    " + (List.class.isAssignableFrom(ArrayList.class)));
        System.out.println("  List 是 Collection?   " + (Collection.class.isAssignableFrom(List.class)));
        System.out.println("  Set 是 Collection?    " + (Collection.class.isAssignableFrom(HashSet.class)));
        System.out.println("  Queue 是 Collection?  " + (Queue.class.isAssignableFrom(ArrayDeque.class)));
        System.out.println("  Map 是 Collection?    " + (Collection.class.isAssignableFrom(HashMap.class)) + " ← false：Map 独立族谱");
        System.out.println("  Deque 是 Queue?       " + (Queue.class.isAssignableFrom(Deque.class)) + "（Deque 双向扩展 Queue）");

        System.out.println();
        System.out.println("== 2. 三族各来一个 ==");
        List<String> list = new ArrayList<>(List.of("a", "b", "a")); // 有序可重复
        Set<String> set = new HashSet<>(list);                         // 去重
        Queue<String> queue = new ArrayDeque<>(List.of("先来的", "后来的"));
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("a", 1);
        map.put("b", 2);
        System.out.println("  List（有序可重复）: " + list);
        System.out.println("  Set（去重后）:      " + set);
        System.out.println("  Queue（先出的）:    " + queue.poll());
        System.out.println("  Map（键值对）:      " + map);

        System.out.println();
        System.out.println("== 3. 选型三问 ==");
        System.out.println("  ① 要不要重复？   要 -> List；不要 -> Set");
        System.out.println("  ② 要不要键值对？ 要 -> Map");
        System.out.println("  ③ 要不要有序/排序？保持插入序 -> Linked 变体；按大小排 -> Tree 变体");

        System.out.println();
        System.out.println("== 4. 遗留同步类 ==");
        System.out.println("  Vector/Hashtable 是上古遗留（全方法 synchronized，性能差），");
        System.out.println("  新代码用 ArrayList/HashMap，并发场景用 concurrent 包对应物");
        System.out.println("  （如 CopyOnWriteArrayList、ConcurrentHashMap）。");
        System.out.println("进阶：Iterator 是统一遍历抽象（fail-fast 见 FailFastDemo）；");
        System.out.println("      Collections.unmodifiableXxx 是视图（底层可变会透出），List.of 才是真不可变。");
    }
}
