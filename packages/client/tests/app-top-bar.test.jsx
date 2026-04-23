import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('#/features/theme/model/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: () => {},
  }),
}))

import { AppTopBar } from '../src/app/components/AppTopBar'

describe('AppTopBar', () => {
  it('does not render Home or Backlog navigation links anymore', () => {
    const markup = renderToStaticMarkup(
      <AppTopBar
        addLabel="Add task"
        backlogCount={3}
        onAddTask={() => {}}
        onOpenBacklog={() => {}}
        searchPlaceholder="Search tasks…"
        searchQuery=""
        setSearchQuery={() => {}}
      />
    )

    expect(markup).not.toContain('>Home<')
    expect(markup).not.toContain('href="/backlogs"')
    expect(markup).toContain('Backlog')
  })

  it('can render a Home CTA without search or add-task controls', () => {
    const markup = renderToStaticMarkup(
      <AppTopBar showAddTask={false} showHomeCta showSearch={false} />
    )

    expect(markup).toContain('>Home<')
    expect(markup).not.toContain('Search tasks')
    expect(markup).not.toContain('Add task')
  })
})
