import { tokenize } from '../lib/content/highlight.js'
import { TOKEN_CLASS } from './RichText.js'

/**
 * 可运行示例代码块（spec §5）：折叠 details + 复用 RichText 的 Java 着色
 * （单色阶荧光笔——与正文代码块同一呈现，不引新依赖）。
 * code 必须是**已剥头**的源码（头 Javadoc 含全部要点口径，见 spec §1 泄露面）。
 */
export function DemoCodeBlock({ code }: { code: string }): React.JSX.Element {
  const tokens = tokenize(code, 'java')
  return (
    <details className="rounded-xl border border-paper-line bg-paper-deep">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-paper-muted transition-colors hover:text-paper-ink">
        可运行示例（Java）
      </summary>
      <div className="border-t border-paper-line/60">
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-paper-ink">
          <code>
            {tokens.map((t, j) => (
              <span key={j} className={TOKEN_CLASS[t.kind]}>{t.text}</span>
            ))}
          </code>
        </pre>
      </div>
    </details>
  )
}
