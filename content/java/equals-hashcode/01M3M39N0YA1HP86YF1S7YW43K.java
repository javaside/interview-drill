package com.interview.java.equalshashcode;

import java.util.HashSet;
import java.util.Set;

/**
 * 题目：equals 依赖可变外部状态（时间/随机数/IP）会出问题吗？
 * 题卡：01M3M39N0YA1HP86YF1S7YW43K
 * 块：java/equals-hashcode
 *
 * 要点口径（与题卡一致）：
 *  - 「一致」指：参与比较的字段没变，答案就不能变
 *  - 掺进时间、随机数、环境这些外部状态 = 击穿「没修改字段」前提
 *  - 后果：上午放进 HashSet，下午 contains 找不到（入桶与比对口径漂移）
 */
public class EqualsMutableStateDemo {

    /** 反面教材：equals/hashCode 掺了「当前秒数」这个外部状态 */
    static class TemperedKey {
        final String id;
        TemperedKey(String id) { this.id = id; }

        private int drift() { return (int) (System.currentTimeMillis() / 1000); }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof TemperedKey k)) return false;
            return id.equals(k.id) && drift() == k.drift(); // 掺了时间！
        }

        @Override
        public int hashCode() {
            return 31 * id.hashCode() + drift(); // hash 也随时间漂移！
        }
        @Override public String toString() { return "Key(" + id + ")"; }
    }

    /** 正面：只依赖自身字段，一致性天然满足 */
    static class StableKey {
        final String id;
        StableKey(String id) { this.id = id; }
        @Override
        public boolean equals(Object o) {
            return o instanceof StableKey k && id.equals(k.id);
        }
        @Override
        public int hashCode() { return id.hashCode(); }
        @Override public String toString() { return "Key(" + id + ")"; }
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("== 1. 一致性被击穿：同一对对象，隔 1 秒答案变了 ==");
        TemperedKey a = new TemperedKey("same");
        TemperedKey b = new TemperedKey("same");
        System.out.println("立刻比较  a.equals(b) -> " + a.equals(b)); // true（同一秒内）
        Thread.sleep(1100);                                           // 等到下一秒
        System.out.println("1 秒之后  a.equals(b) -> " + a.equals(b)); // false！字段没变，答案变了

        System.out.println();
        System.out.println("== 2. 后果：上午放进 HashSet，下午 contains 找不到 ==");
        Set<TemperedKey> set = new HashSet<>();
        TemperedKey in = new TemperedKey("same");
        set.add(in);
        System.out.println("刚放入时 contains(new 相同 id) -> " + set.contains(new TemperedKey("same")));
        Thread.sleep(1100);
        System.out.println("1 秒后   contains(new 相同 id) -> " + set.contains(new TemperedKey("same"))); // false
        System.out.println("机理：contains 按新实例「现在」的 hash 定桶，元素却在「当年」的桶里——");
        System.out.println("      入桶与比对口径漂移，两头对不上。");

        System.out.println();
        System.out.println("== 3. 对照组：只依赖自身字段 ==");
        Set<StableKey> ok = new HashSet<>();
        ok.add(new StableKey("same"));
        Thread.sleep(1100);
        System.out.println("隔 1 秒 contains -> " + ok.contains(new StableKey("same"))); // 永远 true

        System.out.println();
        System.out.println("结论：equals/hashCode 只能用「对象自身的不变字段」；可变 key 的失踪问题同源");
        System.out.println("      （见 hashmap 包的 MutatedKeyDemo）。");
    }
}
