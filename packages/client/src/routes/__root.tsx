import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { Footer } from '#/app/components/Footer'
import { BoardProvider } from '#/features/task-board/model/provider'
import { TaskDialog } from '#/features/task-editor/components/TaskDialog'
import { themeInitScript } from '#/features/theme/model/theme'
import { TooltipProvider } from '#/shared/ui/tooltip'
import appCss from '../app/styles/index.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Agent Todo' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <BoardProvider>
        <div className="flex h-dvh flex-col">
          <main className="min-h-0 flex-1">
            <Outlet />
          </main>
          <Footer />
        </div>
        <TaskDialog />
      </BoardProvider>
    </TooltipProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* No-flash theme init — static trusted constant, runs before paint */}
        <script>{themeInitScript}</script>
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
