package com.interview.java.reflectionproxy;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

/**
 * 题目：JDK 动态代理的原理？
 * 题卡：01M3M39N0ZVK25VC2HMSK3EKB2
 * 块：java/reflection-proxy
 *
 * 要点口径（与题卡一致）：
 *  - Proxy.newProxyInstance(loader, interfaces, handler) 给接口动态造替身
 *  - 机理：JVM 运行时生成字节码造出 $Proxy0 implements 接口，
 *    每个方法体只有一句——把参数打包转发给 InvocationHandler.invoke
 *  - 限制：只能代理接口（代理类必须继承 Proxy 基类，Java 单继承名额被占）
 */
public class JdkDynamicProxyDemo {

    interface UserService {
        String save(String name);
        int level();
    }

    static class UserServiceImpl implements UserService {
        @Override public String save(String name) { return "已保存:" + name; }
        @Override public int level() { return 3; }
    }

    /** 统一拦截入口：所有代理方法都落到这一个 invoke */
    static class LoggingHandler implements InvocationHandler {
        private final Object target;
        LoggingHandler(Object target) { this.target = target; }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            System.out.println("  [before] " + method.getName() + " " + java.util.Arrays.toString(args));
            Object result = method.invoke(target, args); // 转发给真实对象
            System.out.println("  [after ] 返回 " + result);
            return result;
        }
    }

    public static void main(String[] args) {
        UserService real = new UserServiceImpl();
        UserService proxy = (UserService) Proxy.newProxyInstance(
                UserService.class.getClassLoader(),
                new Class<?>[]{UserService.class},
                new LoggingHandler(real));

        System.out.println("== 1. 使用：所有调用先过 handler ==");
        proxy.save("张三");
        proxy.level();

        System.out.println();
        System.out.println("== 2. 机理：$Proxy0 长什么样 ==");
        Class<?> proxyClass = proxy.getClass();
        System.out.println("  代理类名: " + proxyClass.getName()); // com.sun.proxy.$Proxy0 之类
        System.out.println("  父类: " + proxyClass.getSuperclass().getName()); // java.lang.reflect.Proxy
        System.out.println("  实现的接口: " + java.util.Arrays.toString(proxyClass.getInterfaces()));
        System.out.println("  它的每个方法体只有一句：handler.invoke(this, method, args)；");
        System.out.println("  字节码由 JVM 运行时生成（java.lang.reflect.ProxyGenerator）。");

        System.out.println();
        System.out.println("== 3. 三个特判方法 ==");
        System.out.println("  toString/hashCode/equals 不会无脑转发——ProxyGenerator 特判，");
        System.out.println("  例如三个接口都有的方法签名冲突时按第一接口处理。");
        System.out.println("  proxy.toString() -> " + proxy.toString().substring(0, Math.min(50, proxy.toString().length())) + "...");

        System.out.println();
        System.out.println("== 4. 为什么只能代理接口 ==");
        System.out.println("  生成的代理类必须 extends java.lang.reflect.Proxy（拿到基础设施），");
        System.out.println("  Java 单继承名额被占了 -> 只能 implements 接口；");
        System.out.println("  没接口就换 CGLIB（子类化，见 JdkProxyVsCglibDemo）。");

        System.out.println();
        System.out.println("进阶：Spring 的 JdkDynamicAopProxy 就是这个机制（包一层拦截器链）；");
        System.out.println("      方法内自调用 this.xxx() 不经过代理对象——事务失效的经典坑。");
    }
}
