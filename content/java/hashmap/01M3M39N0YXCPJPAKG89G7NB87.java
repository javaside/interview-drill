package com.interview.java.hashmap;

/**
 * 题目：HashMap 的 hash 扰动函数为什么那样设计？
 * 题卡：01M3M39N0YXCPJPAKG89G7NB87
 * 块：java/hashmap
 *
 * 要点口径（与题卡一致）：
 *  - 定位下标只用 hash 的低几位（(n-1)&hash，n=16 时就是低 4 位）
 *  - key 的 hash 只有高位有差异时，低位全一样 -> 全挤进同一个桶
 *  - 扰动 (h ^ h>>>16) 把高 16 位的信息混进低 16 位
 *  - 代价仅一次移位异或，几乎白赚
 */
public class HashPerturbationDemo {

    /** 还原 HashMap.hash 的扰动函数 */
    static int perturb(int h) {
        return h ^ (h >>> 16);
    }

    public static void main(String[] args) {
        System.out.println("== 1. 问题：定桶只看低几位 ==");
        int n = 16;
        System.out.println("  n=16 时 (n-1)&hash 就是取低 4 位。看这组 hash（高位不同、低位相同）：");
        int[] hashes = {0x00000005, 0x00100005, 0x00200005, 0x00300005, 0x7F000005};
        System.out.printf("  %-12s %-34s %s%n", "hash", "二进制(高→低)", "不扰动的桶");
        for (int h : hashes) {
            System.out.printf("  0x%08X  ...%-30s %d%n", h,
                    String.format("%32s", Integer.toBinaryString(h)).replace(' ', '0').substring(8),
                    h & (n - 1));
        }
        System.out.println("  全进 5 号桶！差异全在高 27 位，而定位只看低 4 位——全被浪费。");

        System.out.println();
        System.out.println("== 2. 扰动：把高 16 位混进低 16 位 ==");
        System.out.printf("  %-12s %-10s %-12s %s%n", "hash", "h>>>16", "扰动后hash", "扰动后桶");
        for (int h : hashes) {
            int p = perturb(h);
            System.out.printf("  0x%08X  0x%08X  0x%08X  %d%n", h, h >>> 16, p, p & (n - 1));
        }
        System.out.println("  同一批 key 被打散到不同桶——高位的信息被「搅」进了定桶的低位。");

        System.out.println();
        System.out.println("== 3. 为什么是 16？==");
        System.out.println("  32 位 hash 移 16 恰好高低对半混合（再移就信息冗余）；");
        System.out.println("  对比 1.7 的 4 次移位+乘法扰动，1.8 的单次移位异或在速度与分布间取平衡；");
        System.out.println("  代价仅一次移位+一次异或，几乎白赚。");

        System.out.println();
        System.out.println("== 4. 什么场景受益？==");
        System.out.println("  内存地址连续的小对象（hash 来自 identityHashCode，低位常相似）、");
        System.out.println("  Float/手写劣质 hashCode 等「差异在高位的 key」。");
        System.out.println("  String 这类本身分布良好的 hash 影响不大，但扰动是零成本保险。");
        System.out.println("  此函数同时服务 HashMap 与 ConcurrentHashMap（那里叫 spread）。");
    }
}
