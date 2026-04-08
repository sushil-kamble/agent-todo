import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { TaskDialog } from '../components/board/TaskDialog'
import { BoardProvider } from '../components/board/store'
import { Footer } from '../components/Footer'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Agent Todo' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  return (
    <BoardProvider>
      <div className="flex h-dvh flex-col">
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <TaskDialog />
    </BoardProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
