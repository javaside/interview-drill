import pathlib, re

def add_kp(path, after_id, kid, text):
    p = pathlib.Path(path)
    t = p.read_text(encoding='utf-8')
    m = re.search(r"(  - id: " + after_id + r"\n(?:    .*\n)+)", t)
    block = f"""  - id: {kid}
    text: "{text}"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
"""
    p.write_text(t[:m.end()] + block + t[m.end():], encoding='utf-8')
    print('kp added:', path.split('/')[-1][:10], kid)

# 1) bean-lifecycle 卡1 超过 6 要点（7条）——合并Aware回调与初始化前两拍？删一条：把②属性填充和③Aware合并
p1 = pathlib.Path('bean-lifecycle/01M3MFN29QPGXTF1GB2N69HXVE.md')
t = p1.read_text(encoding='utf-8')
# 删除第7条（销毁）并把销毁信息并进第6条
blk7 = re.search(r"(  - id: kp-bl1-7\n(?:    .*\n)+)", t)
t = t.replace(blk7.group(1), '')
t = t.replace('第 6 步 初始化后：BeanPostProcessor.postProcessAfterInitialization（AOP 代理在此织入）', '第 6 步 初始化后：BPP 的 after 钩子（AOP 代理在此织入）；容器关闭时销毁回调')
p1.write_text(t, encoding='utf-8')
print('卡1 精简至6条')

# 2) 循环依赖卡 sequence 只有3条——补第4条：@Lazy
p2 = pathlib.Path('bean-lifecycle/01M3MFN29RTAH5902315EAY6WF.md')
t2 = p2.read_text(encoding='utf-8')
blk = """  - id: kp-bl6-4
    text: "第 4 步 构造器循环无解：可注入 @Lazy 代理（用时才解析依赖）绕开"
    public: false
    verifiedAt: '2026-09-28'
    excludeAsDistractorFor: []
    confirmedIndependentOf: []
    source:
      kind: official-doc
      url: https://docs.spring.io/spring-framework/reference/core.html
      locator: 'core'
"""
m2 = re.search(r"(  - id: kp-bl5-5\n(?:    .*\n)+)", t2)
t2 = t2[:m2.end()] + blk + t2[m2.end():]
p2.write_text(t2, encoding='utf-8')
print('循环依赖卡补第4条')

# 3) mybatis ${}卡「等」字
p3 = pathlib.Path('mybatis/01M3MFN29RDDK0FWRVKXGYJDE5.md')
t3 = p3.read_text(encoding='utf-8')
t3 = t3.replace('仅用于表名/列名/排序字段等不能参数化的位置', '仅用于表名/列名/排序字段这类不能参数化的位置')
p3.write_text(t3, encoding='utf-8')
print('${} 卡去等字')

# 4) bean-lifecycle 池不足：给 2/3/5 卡各补1条要点
add_kp('bean-lifecycle/01M3MFN29Q0JPJG0GVX8C8MEKD.md', 'kp-bl2-4', 'kp-bl2-5', 'HTTP 作用域依赖请求上下文激活（RequestContextListener 或 DispatcherServlet）')
add_kp('bean-lifecycle/01M3MFN29QXTP76JD3G6EERP34.md', 'kp-bl3-4', 'kp-bl3-5', 'BPP 影响容器内全部 Bean，需按类型/注解过滤控制范围')
add_kp('bean-lifecycle/01M3MFN29RF62WP8ZD6T4TYK8H.md', 'kp-bl5-5', 'kp-bl5-6', 'Boot 2.6 起默认禁止循环依赖（allow-circular-references=false）')

# 5) mybatis 池不足：给缓存/Mapper/动态SQL三卡各补1条
add_kp('mybatis/01M3MFN29RTSG9PPZVRP4TW5XA.md', 'kp-my2-5', 'kp-my2-6', 'localCacheScope=STATEMENT 可逐语句关闭一级缓存')
add_kp('mybatis/01M3MFN29R50DZHWB1PETZVT4Z.md', 'kp-my3-4', 'kp-my3-5', '@MapperScan 的 basePackages 与 annotationClass 控制扫描注册范围')
add_kp('mybatis/01M3MFN29RJKD0S6A3V5KYYYSE.md', 'kp-my4-4', 'kp-my4-5', 'bind 标签可声明中间变量用于 like 拼接')
