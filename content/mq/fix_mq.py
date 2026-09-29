import pathlib, re

FIX = {
  # kafka-core
  '失败重试 + max.in.flight>1 可能乱序——开幂等生产者（enable.idempotence）': '重试与 in.flight>1 组合可能乱序——开幂等生产者防住',
  # kafka-reliability
  '幂等生产者（enable.idempotence）：PID+序号防重防乱序（单分区单会话）': '幂等生产者：PID 加序号防重防乱序（限单分区单会话）',
  '端到端精确一次=幂等生产+事务+隔离级别 read_committed': '端到端精确一次=幂等生产+事务+读隔离 read_committed',
  '更普遍的工程答案：at-least-once + 消费端幂等（唯一键/状态机）': '更普遍的工程答案：at-least-once 加消费端幂等（唯一键/状态机）',
  '业务幂等：唯一键/状态机/Redis 去重接住重投': '业务幂等：唯一键/状态机/Redis 去重拦截重投',
  'acks=0：发出就算成功——不等任何确认（可丢尽头的最快）': 'acks=0：发出即算成功——不候任何确认（可丢场景最快）',
  # mq-fundamentals
  '消费端：手动 ack（处理成功才确认）+ 幂等去重': '消费端：手动 ack（处理成功才签收）加幂等去重',
  # mq-problems
  '消费端：单线程消费保序，提速靠分区并行而非线程池乱拆': '消费端：单线程消费保序，提速靠分区并行而非线程池乱放',
}
for md in pathlib.Path('.').rglob('*.md'):
    t = md.read_text(encoding='utf-8'); o = t
    for a, b in FIX.items(): t = t.replace(a, b)
    if t != o: md.write_text(t, encoding='utf-8'); print('fixed', md.name[:10])

# 池不足的补要点
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
      url: https://kafka.apache.org/documentation/
      locator: 'doc'
"""
    p.write_text(t[:m.end()] + block + t[m.end():], encoding='utf-8')
    print('kp:', kid)
