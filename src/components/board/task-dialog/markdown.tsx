import type { ComponentProps } from 'react'

function rewriteFileHref(href: string | undefined): string | null {
  if (!href) return null
  let pathname: string
  let hash = ''
  try {
    const u = new URL(href, 'http://localhost')
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.hostname && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null
    pathname = u.pathname
    hash = u.hash
  } catch {
    return null
  }
  if (!pathname.startsWith('/')) return null
  if (!/\.[A-Za-z0-9]+$/.test(pathname)) return null
  const lineMatch = hash.match(/^#L(\d+)(?:[-:](\d+))?/)
  const line = lineMatch ? lineMatch[1] : null
  const col = lineMatch?.[2] ?? null
  let uri = `vscode://file${pathname}`
  if (line) uri += `:${line}${col ? `:${col}` : ''}`
  return uri
}

export const MD_COMPONENTS = {
  p: (props: ComponentProps<'p'>) => (
    <p className="my-1.5 first:mt-0 last:mb-0 leading-snug" {...props} />
  ),
  strong: (props: ComponentProps<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: (props: ComponentProps<'em'>) => <em className="italic" {...props} />,
  a: ({ href, ...props }: ComponentProps<'a'>) => {
    const rewritten = rewriteFileHref(href)
    return (
      <a
        className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground break-all"
        target={rewritten ? undefined : '_blank'}
        rel="noreferrer noopener"
        href={rewritten ?? href}
        {...props}
      />
    )
  },
  ul: (props: ComponentProps<'ul'>) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted-foreground" {...props} />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground" {...props} />
  ),
  li: (props: ComponentProps<'li'>) => <li className="leading-snug" {...props} />,
  h1: (props: ComponentProps<'h1'>) => (
    <h1
      className="font-heading mt-3 mb-1.5 text-[0.9rem] leading-tight tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h2: (props: ComponentProps<'h2'>) => (
    <h2
      className="font-heading mt-3 mb-1.5 text-[0.82rem] leading-tight tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h3: (props: ComponentProps<'h3'>) => (
    <h3
      className="mt-2.5 mb-1 text-[0.82rem] font-semibold tracking-[0.02em] text-foreground uppercase first:mt-0"
      {...props}
    />
  ),
  code: ({
    inline,
    className,
    children,
    ...rest
  }: ComponentProps<'code'> & { inline?: boolean }) => {
    if (inline === false) {
      return (
        <code className={`font-mono text-[0.78rem] ${className ?? ''}`} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="border border-border bg-muted px-1 py-px font-mono text-[0.78rem] text-foreground"
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: (props: ComponentProps<'pre'>) => (
    <pre
      className="my-2 overflow-x-auto border border-border bg-muted p-2 font-mono text-[0.75rem] leading-snug text-foreground"
      {...props}
    />
  ),
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote
      className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: (props: ComponentProps<'table'>) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border border-border text-[0.78rem]" {...props} />
    </div>
  ),
  th: (props: ComponentProps<'th'>) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: (props: ComponentProps<'td'>) => (
    <td className="border border-border px-2 py-1 align-top" {...props} />
  ),
} as const
