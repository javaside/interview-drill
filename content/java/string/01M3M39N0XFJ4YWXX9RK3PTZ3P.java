package com.interview.java.string;

/**
 * 题目：String.trim() 和 strip() 的区别？
 * 题卡：01M3M39N0XFJ4YWXX9RK3PTZ3P
 * 块：java/string
 *
 * 要点口径（与题卡一致）：
 *  - trim()：只认 ASCII <= U+0020 的空白（空格、\t、\n 这批）
 *  - strip()（Java 11+）：按 Unicode 空白标准（Character.isWhitespace）
 *  - 配套：isBlank()（全是空白算空）vs isEmpty()（长度为 0 才算空）
 *  - 细节：NBSP（U+00A0）连 strip 都不去（isWhitespace(NBSP)=false）
 */
public class TrimVsStripDemo {

    public static void main(String[] args) {
        String halfWidth = "  hello  ";   // 普通半角空格 U+0020
        String fullWidth = "\u3000hello\u3000"; // 中文全角空格 U+3000
        String nbsp      = "\u00A0hello\u00A0"; // 不换行空格 NBSP U+00A0

        System.out.println("== 1. 半角空格 U+0020：两者都能去 ==");
        System.out.println("trim  -> [" + halfWidth.trim() + "]");
        System.out.println("strip -> [" + halfWidth.strip() + "]");

        System.out.println();
        System.out.println("== 2. 全角空格 U+3000：trim 不认识，strip 认识 ==");
        System.out.println("trim  -> [" + fullWidth.trim() + "]");   // 全角空格原样保留！
        System.out.println("strip -> [" + fullWidth.strip() + "]");  // 干净去掉
        System.out.println("原因：trim 只砍 ASCII <= U+0020；strip 按 Character.isWhitespace（Unicode 标准）。");

        System.out.println();
        System.out.println("== 3. NBSP U+00A0：连 strip 都不去（细节考点）==");
        System.out.println("trim  -> [" + nbsp.trim() + "]");
        System.out.println("strip -> [" + nbsp.strip() + "]"); // 也去不掉！
        System.out.println("原因：Character.isWhitespace('\\u00A0') = " + Character.isWhitespace('\u00A0') + "（NBSP 不算 Unicode 空白）");

        System.out.println();
        System.out.println("== 4. 配套方法：isBlank vs isEmpty ==");
        System.out.println("\" \".isEmpty()  -> " + " ".isEmpty());   // false：长度不是 0
        System.out.println("\" \".isBlank()  -> " + " ".isBlank());   // true：全是空白就算空
        System.out.println("\"\".isBlank()   -> " + "".isBlank());    // true：长度 0 自然也 blank

        System.out.println();
        System.out.println("结论：现代代码一律用 strip()；Java 11+ 还提供 stripLeading/stripTrailing/lines()。");
    }
}
