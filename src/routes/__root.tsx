import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { BoardProvider } from "../components/board/store";
import { NewTaskDialog } from "../components/board/NewTaskDialog";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Agent Todo" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  return (
    <BoardProvider>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <NewTaskDialog />
    </BoardProvider>
  );
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
  );
}
