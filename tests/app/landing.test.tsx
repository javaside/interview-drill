import { render, screen } from '@testing-library/react'
import { Landing } from '../../src/app/(drill)/Landing.js'

const totals = { cards: 404, blocks: 81, categories: 12 }
const tracks = ['Java 后端', '架构师', 'Agent 开发']

test('首屏价值主张：题海刷不完知识点刷得完 + 真实库量统计', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('题海刷不完')
  expect(root).toHaveTextContent('知识点刷得完')
  // 真实数字入页（非演示数字）
  expect(root).toHaveTextContent('404')
  expect(root).toHaveTextContent('81')
  expect(root).toHaveTextContent('12')
})

test('首屏正文：核心 + 有日期（冲刺）+ 没日期也行（常备/自由刷）+ AI', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const hero = screen.getByTestId('landing-hero-copy').textContent ?? ''
  // 核心主张：不是「看会」是「练会」
  expect(hero).toContain('八股不是背会的，是练会的')
  // **推荐逻辑**（产品核心，不能因为改别的句子被挤掉）：题怎么排不用用户挑
  expect(hero).toContain('填了面试日期，题自己会排')
  // 三条规则逐条对应代码（见下方注释），改文案时不许删：
  //   高频优先 → assignFinalDays 按 frequency 降序从 E 往前填，高频拿最靠近面试的日子
  expect(hero).toContain('最常问的先来')
  //   答错重排 → regenerateAfterFailure：得分 <1/2 起始档归零、从明天起，所以追着你练
  expect(hero).toContain('没记住的追着你练')
  //   掌握度调间隔 → startTier + INTERVALS=[1,2,4,8,16,32,64]，越熟起跳越靠后
  expect(hero).toContain('练熟的少打扰')
  // 结果：末次压在面试前（E = R − buffer）
  expect(hero).toContain('到面试前，每道题都刚练过')
  // **没有日期也能刷**（schedule.ts:122 的 maintenance 分支：readyByDate 为空或已过
  // 时照样出题，按 MAINTAIN_INTERVALS 滚动）。此前文案写「你只说哪天面试」把这条
  // 路径说没了，会把没定日期的用户劝退——必须显式写出来
  expect(hero).toContain('不填日期也能刷')
  expect(hero).toContain('该复习的自己回来')
  // 自由刷（/practice?block=，不看排期、不占今日分母）
  expect(hero).toContain('想单刷哪一块随时挑')
  // AI：卡住当场问，只讲这一道
  expect(hero).toContain('卡住就问 AI')
  expect(hero).toContain('它只讲这一道')
  // 结构守卫：不是「所以这里 A：… B：… C：…」式罗列，也不写操作步骤
  expect(hero).not.toContain('所以这里')
  expect(hero).not.toContain('先圈定')
  expect(hero).not.toContain('再定下')
  // 反向守卫：不能暗示「必须先有面试日期」（这是本轮修掉的错）
  expect(hero).not.toContain('你只说哪天面试')
  // 不讲产品机制词，也不复述标题里已说的「题海/知识点」
  for (const jargon of ['干扰项', '排期', '要点', '掌握度', '保质期', '常备模式', '就绪日']) {
    expect(hero, `首屏正文出现机制词「${jargon}」`).not.toContain(jargon)
  }
  expect(hero).not.toContain('题海')
})

test('卖点标题写成「用户会问自己的那句话」，而不是功能名', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const titles = Array.from(
    screen.getByTestId('landing').querySelectorAll('ol.grid.md\\:grid-cols-2 li h3'),
  ).map(el => el.textContent ?? '')
  expect(titles).toHaveLength(4)
  for (const t of titles) {
    expect(t, `卖点标题「${t}」不是问题导向（应写成用户会问自己的那句话）`).toMatch(/？$/)
  }
})

test('卖点与「怎么用」不重复：面试冲刺讲「临时加急」，排讲「长期倒推」', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  const loop = screen.getByTestId('landing-loop').textContent ?? ''
  const sprint = Array.from(root.querySelectorAll('ol.grid.md\\:grid-cols-2 li'))
    .map(li => li.textContent ?? '').find(t => t.includes('面试就剩几天')) ?? ''
  // 冲刺卖点讲重铺计划（cram 场景）
  expect(sprint).toContain('重铺成冲刺计划')
  // 而「倒推每天刷几题」只归「排」一步，避免两处说同一句话
  expect(loop).toContain('倒推每天刷几题')
  expect(sprint).not.toContain('倒推每天刷几题')
})

test('全文不出现内部术语（用户看不懂的词）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing').textContent ?? ''
  // 逐个都是真实踩过的：数据模型词 / 黑话 / 产品内部动作名
  for (const jargon of ['要点', '闭环', '映射', '专刷', '排期']) {
    expect(root, `出现内部术语「${jargon}」`).not.toContain(jargon)
  }
})

test('双 CTA：GitHub 登录（主）+ 先逛逛知识库（旁路）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  expect(screen.getByTestId('signin-cta')).toHaveAttribute('href', '/api/auth/signin?callbackUrl=/drill')
  expect(screen.getByTestId('landing-browse')).toHaveAttribute('href', '/map')
})

test('价值主张：四个卖点', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('卡住了没人问？')
  expect(root).toHaveTextContent('看不懂术语？')
  expect(root).toHaveTextContent('不知道从哪刷起？')
  expect(root).toHaveTextContent('面试就剩几天？')
  // 岗位名来自库（tracks 传入），不硬编码漂移
  expect(root).toHaveTextContent('Java 后端 / 架构师 / Agent 开发')
})

test('卖点条数为偶数：双列网格不留孤儿（奇数条末行会空一半，像排版坏了）', () => {
  const { unmount } = render(<Landing totals={totals} tracks={tracks} />)
  const grid = screen.getByTestId('landing').querySelector('ol.grid.md\\:grid-cols-2')
  expect(grid?.children.length).toBe(4)   // 2×2
  unmount()

  // 老库无岗位包时是 3 条（退化场景）：这里只保证不因缺岗位项而出错
  render(<Landing totals={totals} tracks={[]} />)
  const grid2 = screen.getByTestId('landing').querySelector('ol.grid.md\\:grid-cols-2')
  expect(grid2?.children.length).toBe(3)
})

test('AI 卖点讲清边界：只聊这道题（把约束讲成卖点，不吹成通用助手）', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  // 两个真实可用场景
  expect(root).toHaveTextContent('这个选项为什么不对')
  expect(root).toHaveTextContent('交卷后我错在哪')
  // 边界写成正面的专注表述（与产品实际行为一致：只围绕本题回答）
  expect(root).toHaveTextContent('只围绕这道题讲')
})

test('怎么用：学 → 练 → 判 → 排 四步都在，讲的是产品形态', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const loop = screen.getByTestId('landing-loop')
  const steps = Array.from(loop.querySelectorAll('h3')).map(el => el.textContent)
  expect(steps).toEqual(['学', '练', '判', '排'])
  expect(loop).toHaveTextContent('先理解再做题')
  expect(loop).toHaveTextContent('逐条判给你看')
  expect(loop).toHaveTextContent('答错的明天就回来')
  expect(loop).toHaveTextContent('倒推每天刷几题')
})

test('登录理由与免费口径：跟账号走 + 免费 2 个完整块 + 闭环口径与「怎么用」一致', () => {
  render(<Landing totals={totals} tracks={tracks} />)
  const root = screen.getByTestId('landing')
  expect(root).toHaveTextContent('进度、判分、复习计划都跟着账号走')
  expect(root).toHaveTextContent('免费刷 2 个知识块')
  expect(root).toHaveTextContent('学 → 练 → 判 → 排')
})

test('无岗位包（老库）：整条岗位价值项不渲染，不出空占位', () => {
  render(<Landing totals={totals} tracks={[]} />)
  expect(screen.queryByText(/岗位一键/)).not.toBeInTheDocument()
})
