/**
 * 路由薄壳的统一错误响应（§5.5/§5.8 端点共用）：业务纯核抛出的 Error（免费墙、
 * 容量校验、块不存在等）转 400 + JSON { error }，让客户端 readJson 能把服务端
 * 中文消息带到设置页的 role=alert，而不是一个干巴巴的 HTTP 500。
 * 非 Error 抛出值给通用消息——不泄内部细节。
 */
export function errorResponse(e: unknown): Response {
  const message = e instanceof Error ? e.message : '请求无法处理'
  return Response.json({ error: message }, { status: 400 })
}
