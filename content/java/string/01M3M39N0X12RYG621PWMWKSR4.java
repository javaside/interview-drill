package com.interview.java.string;

/**
 * 题目：String 的 hashCode 是怎么算的？
 * 题卡：01M3M39N0X12RYG621PWMWKSR4
 * 块：java/string
 *
 * 要点口径（与题卡一致）：
 *  - 公式 h = 0; 对每个字符 c：h = 31*h + c（即 s[0]*31^(n-1) + ... + s[n-1]），结果缓存
 *  - 首字符权重最大，"Aa" 和 "BB" 这种巧值会撞出相同 hash
 *  - 算好的结果缓存在 hash 字段（不可变才敢缓存）
 *  - 系数 31：奇素数、JIT 可优化成 (i<<5)-i、碰撞分布尚可——历史选择
 */
public class StringHashCodeDemo {

    /** 手写多项式哈希，模拟 String.hashCode 的实现 */
    static int polynomialHash(String s) {
        int h = 0;
        for (int i = 0; i < s.length(); i++) {
            h = 31 * h + s.charAt(i);
        }
        return h;
    }

    public static void main(String[] args) {
        System.out.println("== 1. 公式：h = 0; 对每个字符 c：h = 31*h + c ==");
        String s = "abc";
        System.out.println("\"abc\".hashCode()      = " + s.hashCode());
        System.out.println("手写 polynomialHash = " + polynomialHash(s)); // 与上面一致
        // 展开即 s[0]*31^2 + s[1]*31^1 + s[2]*31^0，首字符权重最大

        System.out.println();
        System.out.println("== 2. 巧值碰撞：\"Aa\" 与 \"BB\" 撞出相同 hash ==");
        // 'A'=65,'a'=97 -> 65*31+97=2112；'B'=66 -> 66*31+66=2112
        String aa = "Aa";
        String bb = "BB";
        System.out.println("\"Aa\".hashCode() = " + aa.hashCode());
        System.out.println("\"BB\".hashCode() = " + bb.hashCode());
        System.out.println("内容不同但 hash 相同：这是哈希碰撞，不是 bug——");
        System.out.println("HashMap 靠 equals 在同桶内区分它们（这就是 hash 与 equals 的分工）。");

        System.out.println();
        System.out.println("== 3. hash 缓存：不可变才敢缓存 ==");
        int first = s.hashCode();
        int second = s.hashCode();
        System.out.println("两次调用 hashCode -> " + first + " / " + second + "（第二次直接读缓存字段，不再计算）");
        System.out.println("String 不可变 => hash 一辈子算一次就够；HashMap key 高频取 hash，这省了大量重复计算。");

        System.out.println();
        System.out.println("== 4. 为什么系数是 31 ==");
        System.out.println("  ① 奇素数（偶系数会丢失一位信息，碰撞更多）；");
        System.out.println("  ② 乘 31 可被 JIT 优化成移位减法：31*i == (i<<5) - i；");
        System.out.println("  ③ 碰撞分布尚可——历史选择，不是唯一解。");

        System.out.println();
        System.out.println("进阶：31 溢出按 2^32 自然回绕；hash 可预测曾是 HashDoS 攻击面，");
        System.out.println("      HashMap 用扰动函数缓解（见 hashmap 包）。");
    }
}
