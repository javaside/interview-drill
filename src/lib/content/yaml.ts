import yaml from 'js-yaml'

/**
 * 全项目统一的 YAML 引擎，parse.ts / block.ts / register.ts 必须都用它。
 *
 * 为什么钉 JSON_SCHEMA：默认的 YAML 1.1 schema 含 timestamp 类型，
 * 会把 `verifiedAt: 2026-09-18` 解析成 Date 对象。JSON_SCHEMA 只有
 * null/bool/int/float/string 五种类型，日期保持字符串，而 `public: true`
 * 仍然是 boolean。
 *
 * 为什么钉 dump 选项：写回时必须与读入格式一致，否则每次写回都会顺手改动
 * 无关字段（实测默认设置会把 `url: https://x` 加上引号），让 diff 失去可读性 ——
 * 而互斥登记是 25-60 小时的人工成果，全靠 PR diff 审查。
 */
export const YAML_ENGINE = {
  // 注：静态检查工具可能对 `yaml.load` 报 PyYAML 的反序列化告警 —— 那条规则针对
  // Python。js-yaml v4 起 `load` 本身就是安全加载器（不安全的那个已移除），
  // 且这里显式钉了 JSON_SCHEMA，比默认更收紧，不存在任意类型构造。
  parse: (s: string) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object,
  stringify: (o: object) =>
    yaml.dump(o, { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true, sortKeys: false }),
}

export const MATTER_OPTS = { engines: { yaml: YAML_ENGINE } }

/**
 * gray-matter 会按输入字符串缓存解析结果，且 `.data` 是缓存里的**引用**。
 * 直接改它会污染缓存 —— 实测同一输入第二次调用会带出第一次的修改结果。
 * 任何要改 data 的地方必须先经过这个函数。
 */
export function detachedData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}
