package com.interview.java.hashmap;

import java.util.HashMap;
import java.util.Map;

/**
 * 题目：HashMap 的扩容（resize）过程是怎样的？
 * 题卡：01M3M39N0Y4GQ9F4PWVRXV0WJ1
 * 块：java/hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 装到 75% 满（size > 容量 x 0.75）就搬家：容量翻倍（16→32→64...），所有元素重新分桶
 *  - JDK8 拆链：翻倍后每个 key 的新位置只有两种可能（新增 bit 0 -> 留原桶；1 -> 原下标+旧容量）
 *  - 不用重算 hash，把原链按这一位劈成两条、各自整体平移
 *  - 0.75 是空间/时间折中的经验值
 */
public class HashMapResizeDemo {

    public static void main(String[] args) {
        System.out.println("== 1. 触发条件与容量序列 ==");
        System.out.println("  默认容量 16、负载因子 0.75：size > 16x0.75=12 就扩容到 32；");
        System.out.println("  依次 16 → 32 → 64 → 128 ...（始终 2 的幂）。");
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < 13; i++) map.put("k" + i, i); // 第 13 个触发首次 resize
        System.out.println("  放 13 个元素后 size=" + map.size() + "（12 之后那次 put 触发了扩容）");

        System.out.println();
        System.out.println("== 2. 拆链：新位置只有两种可能 ==");
        System.out.println("  翻倍后定位用的 (n-1) 多出一位。看每个 hash 的「新增位」：");
        int oldCap = 8;
        System.out.printf("  %-6s %-10s %-14s %-16s %s%n", "hash", "二进制", "旧桶(h&7)", "新增位(=hash&8)", "新桶(h&15)");
        for (int h : new int[]{3, 11, 19, 27, 5}) {
            System.out.printf("  %-6d %-10s %-14d %-16d %d%n",
                    h, Integer.toBinaryString(h), h & (oldCap - 1),
                    (h & oldCap) != 0 ? 1 : 0, h & (oldCap * 2 - 1));
        }
        System.out.println("  规律：新增位=0 -> 新桶号 == 旧桶号（留下）；");
        System.out.println("        新增位=1 -> 新桶号 == 旧桶号 + 旧容量（平移 8）。");

        System.out.println();
        System.out.println("== 3. 验证「+旧容量」规律 ==");
        for (int h : new int[]{3, 11, 19}) {
            int oldIdx = h & 7;
            int newIdx = h & 15;
            String where = newIdx == oldIdx ? "留原桶" : "去 原下标+" + (newIdx - oldIdx);
            System.out.printf("  hash=%2d: 旧桶 %d -> 新桶 %2d（%s）%n", h, oldIdx, newIdx, where);
        }
        System.out.println("  所以 JDK8 不重算 hash：把原链按新增位劈成 lo/hi 两条，整体平移即可；");
        System.out.println("  子链内部顺序不变（尾插原序），1.7 的重新散列+头插又慢又危险。");

        System.out.println();
        System.out.println("== 4. 实用推论：预估容量的公式 ==");
        System.out.println("  预期放 n 个：初始容量给 n/0.75 + 1（再被 tableSizeFor 取到 2 的幂），");
        System.out.println("  免去一路上 16→32→64 的反复搬家。new HashMap<>(预期/0.75f+1)。");

        System.out.println();
        System.out.println("进阶：0.75 是空间/时间折中的经验值（泊松期望下链冲突率可控）；");
        System.out.println("      树化节点在 resize 中 split 成 lo/hi 两条树链，退树判定同时发生。");
    }
}
