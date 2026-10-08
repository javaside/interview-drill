package com.interview.java.hashmap;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 题目：HashMap key 放进桶后再改参与 hash 的字段，get 还会找到它吗？
 * 题卡：01M3M39N0YJQ9ETGS6ZDRW1J9B
 * 块：java/hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 放进去后再改 key 的字段（参与 hashCode 的字段）：hash 变了，但人还留在旧桶里
 *  - get(key) 按新 hash 去新桶找 -> 找不到；remove 同样删不掉
 *  - 它成了孤儿：占着桶、永远访问不到（除非 key 又改回去）
 *  - 结论：key 必须不可变；value 随便变，不影响定位
 */
public class MutatedKeyDemo {

    /** 可变的 key（反面教材：参与 hashCode 的字段可改） */
    static class Account {
        String no; // 参与 hash 与 equals
        Account(String no) { this.no = no; }
        @Override public int hashCode() { return Objects.hash(no); }
        @Override public boolean equals(Object o) { return o instanceof Account a && no.equals(a.no); }
        @Override public String toString() { return "Account(" + no + ")"; }
    }

    public static void main(String[] args) {
        Map<Account, String> map = new HashMap<>();

        System.out.println("== 1. 正常放入与读取 ==");
        Account key = new Account("A001");
        map.put(key, "张三的账户");
        System.out.println("  put 后 get(new Account(\"A001\")) -> " + map.get(new Account("A001"))); // 正常

        System.out.println();
        System.out.println("== 2. 改 key 字段：hash 变了，人还在旧桶 ==");
        key.no = "B002"; // 参与 hashCode 的字段被改！
        System.out.println("  key.no 改成 B002 后：");
        System.out.println("  map.get(key)（用同一个对象引用）-> " + map.get(key)); // null！
        System.out.println("  为什么？定位走 hash：现在的 key hash 按 B002 算，");
        System.out.println("  去的是 B002 对应的桶；而条目还在 A001 对应的旧桶里——找错门牌号。");

        System.out.println();
        System.out.println("== 3. remove 也删不掉：成了孤儿 ==");
        System.out.println("  map.remove(key) -> " + map.remove(key)); // null，删不掉
        System.out.println("  map.size() -> " + map.size());           // 1，还占着桶
        System.out.println("  孤儿条目：占内存、永远访问不到（除非把 key.no 改回 A001）：");
        key.no = "A001"; // 改回去！
        System.out.println("  改回 A001 后 map.get(key) -> " + map.get(key)); // 又找到了

        System.out.println();
        System.out.println("== 4. value 随便变，不影响定位 ==");
        Map<String, StringBuilder> ok = new HashMap<>();
        ok.put("k", new StringBuilder("v1"));
        ok.get("k").append("→v2"); // 改的是 value 的内容
        System.out.println("  改 value 内容后 get(\"k\") -> " + ok.get("k")); // 正常：定位只看 key 的 hash

        System.out.println();
        System.out.println("结论：key 必须不可变——String、Integer 天然合格；");
        System.out.println("      自定义对象把参与 equals/hashCode 的字段设 final。");
        System.out.println("      本质是「hash 不变量契约」被破坏（EqualsMutableStateDemo 同源）。");
    }
}
