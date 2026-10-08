package com.interview.java.equalshashcode;

/**
 * 题目：equals 方法要满足哪些性质？
 * 题卡：01M3M39N0Y2DQW49714AEBHA48
 * 块：java/equals-hashcode
 *
 * 要点口径（与题卡一致）：
 *  - 五条军规：自反、对称、传递、一致、非空（违反任何一条，集合就会灵异）
 *  - 对称破坏的经典：父类拿子类比出 true、子类拿父类比出 false（子类加字段常见）
 *  - ArrayList.contains 时灵时不灵的根源
 */
public class EqualsContractDemo {

    static class Point {
        final int x, y;
        Point(int x, int y) { this.x = x; this.y = y; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o instanceof Point p) return x == p.x && y == p.y;
            // 对称性陷阱：拿「任何 Point 及其子类」只比坐标
            return false;
        }
        @Override
        public int hashCode() { return 31 * x + y; }
        @Override
        public String toString() { return "Point(" + x + "," + y + ")"; }
    }

    /** 子类加了字段，equals 只认「同为我这种类型」——和父类的 equals 口径冲突 */
    static class ColorPoint extends Point {
        final String color;
        ColorPoint(int x, int y, String color) { super(x, y); this.color = color; }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof ColorPoint cp)) return false; // 只跟 ColorPoint 比
            return super.equals(cp) && color.equals(cp.color);
        }
        @Override
        public int hashCode() { return 31 * super.hashCode() + color.hashCode(); }
        @Override
        public String toString() { return "ColorPoint(" + x + "," + y + "," + color + ")"; }
    }

    public static void main(String[] args) {
        System.out.println("== 五条军规 ==");
        System.out.println("  1. 自反：x.equals(x) 必须 true");
        System.out.println("  2. 对称：a.equals(b) 则 b.equals(a)");
        System.out.println("  3. 传递：a=b、b=c 则 a=c");
        System.out.println("  4. 一致：字段没变，比多少次结果一样（别掺随机/时间）");
        System.out.println("  5. 非空：跟 null 永远 false");

        System.out.println();
        System.out.println("== 自反 / 非空（正常实现天然满足）==");
        Point p = new Point(1, 2);
        System.out.println("p.equals(p) -> " + p.equals(p));       // true
        System.out.println("p.equals(null) -> " + p.equals(null)); // false

        System.out.println();
        System.out.println("== 对称性破坏的经典：Point vs ColorPoint ==");
        Point plain = new Point(1, 2);
        ColorPoint colored = new ColorPoint(1, 2, "red");
        System.out.println("plain.equals(colored) -> " + plain.equals(colored));   // true：父类版本只比坐标
        System.out.println("colored.equals(plain)  -> " + colored.equals(plain));  // false：子类还要比 color
        System.out.println("对称性被击穿：a=b 而 b!=a。");

        System.out.println();
        System.out.println("== 后果：List.contains 时灵时不灵 ==");
        java.util.List<Point> list = new java.util.ArrayList<>();
        list.add(colored); // 里面放的是 ColorPoint
        System.out.println("list.contains(new Point(1,2)) -> " + list.contains(plain)); // true（plain 视角相等）
        java.util.List<Point> list2 = new java.util.ArrayList<>();
        list2.add(plain);  // 里面放的是 Point
        System.out.println("list2.contains(colored) -> " + list2.contains(colored));   // false（colored 视角不等）
        System.out.println("谁在「里面」决定了结果——这就是违反对称性的灵异。");

        System.out.println();
        System.out.println("解法：Effective Java 的 canEqual 方案（双方协商可比较性），");
        System.out.println("      或组合优先于继承（Point 里放 color 字段可空））。");
        System.out.println("进阶：Float.NaN 的 equals 特殊（NaN equals NaN 为 true，-0.0f 与 0.0f 不等）。");
    }
}
