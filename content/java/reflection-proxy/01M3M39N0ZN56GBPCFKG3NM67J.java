package com.interview.java.reflectionproxy;

import java.lang.reflect.Proxy;

/**
 * 题目：JDK 动态代理和 CGLIB 的区别？
 * 题卡：01M3M39N0ZN56GBPCFKG3NM67J
 * 块：java/reflection-proxy
 *
 * 要点口径（与题卡一致）：
 *  - JDK 动态代理：面向接口。生成类 implements 接口，调用转给 InvocationHandler。没接口就抓瞎
 *  - CGLIB：面向继承。运行时生成目标类子类，覆盖方法插入拦截（MethodInterceptor）
 *    要求可继承、方法非 final——final 类/方法、private、static 都代理不了
 *  - Spring：有接口默认 JDK、没有则 CGLIB；Spring Boot 2+ 全 CGLIB（proxyTargetClass=true）
 *
 * 本项目零依赖，CGLIB 部分为讲解性演示（手写子类模拟其思路）。
 */
public class JdkProxyVsCglibDemo {

    interface UserService {
        String save(String name);
    }

    static class UserServiceImpl implements UserService {
        @Override public String save(String name) { return "保存了 " + name; }
    }

    /** 手写「子类覆盖」——CGLIB 在运行时生成的就是这样的子类（字节码版） */
    static class UserServiceCglibStyle extends UserServiceImpl {
        @Override
        public String save(String name) {
            System.out.println("    [CGLIB式拦截-before] " + name);
            String result = super.save(name); // 调用父类（目标类）原方法
            System.out.println("    [CGLIB式拦截-after]");
            return result;
        }
    }

    /** final 类：CGLIB 死刑（子类化不可能） */
    static final class Locked { }

    public static void main(String[] args) {
        System.out.println("== 1. JDK 动态代理：面向接口 ==");
        UserServiceImpl real = new UserServiceImpl();
        UserService jdkProxy = (UserService) Proxy.newProxyInstance(
                UserService.class.getClassLoader(),
                new Class<?>[]{UserService.class},
                (p, method, args1) -> {
                    System.out.println("    [JDK代理-before] " + method.getName());
                    Object r = method.invoke(real, args1); // 转发给真实对象
                    System.out.println("    [JDK代理-after]");
                    return r;
                });
        System.out.println("  调用结果: " + jdkProxy.save("张三"));
        System.out.println("  代理类: " + jdkProxy.getClass().getName() + "（运行时生成的 $ProxyN）");
        System.out.println("  实现的接口: " + java.util.Arrays.toString(jdkProxy.getClass().getInterfaces()));

        System.out.println();
        System.out.println("== 2. CGLIB 思路：面向继承（手写模拟其生成的子类）==");
        UserServiceImpl cglibStyle = new UserServiceCglibStyle();
        System.out.println("  调用结果: " + cglibStyle.save("李四"));
        System.out.println("  CGLIB 运行时用 ASM 生成 extends UserServiceImpl 的子类，");
        System.out.println("  覆写非 final 方法 -> MethodInterceptor.intercept -> super.xxx()");
        System.out.println("  目标类【没有实现任何接口】也照常工作——这是它相对 JDK 代理的核心优势。");

        System.out.println();
        System.out.println("== 3. CGLIB 的禁区 ==");
        System.out.println("  final 类: " + Locked.class.getName() + " —— 不能被继承，CGLIB 抓瞎；");
        System.out.println("  final 方法：子类改写不了，代理失效（静默放行原方法）；");
        System.out.println("  private / static 方法：不构成覆盖，代理不了；");
        System.out.println("  构造器也代理不了（CGLIB 用 Objenesis 绕开实例化）。");

        System.out.println();
        System.out.println("== 4. Spring 的选择逻辑 ==");
        System.out.println("  有接口 -> 默认 JDK 代理；没接口 -> CGLIB；");
        System.out.println("  Spring Boot 2+ 干脆全 CGLIB（proxyTargetClass=true）——");
        System.out.println("  避免「注入类型必须是接口」带来的割裂（注入具体类也能命中代理）。");
        System.out.println("  经典坑：方法内自调用 this.xxx() 不走代理（事务失效的常见原因）。");
        System.out.println("进阶：CGLIB 底层 ASM；FastClass 索引直呼方法避免反射；");
        System.out.println("      JDK17+ 字节码生成受限令内嵌版升级（Spring 6 自 fork cglib）。");
    }
}
