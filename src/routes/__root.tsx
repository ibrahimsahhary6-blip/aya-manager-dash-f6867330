import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthGate } from "@/components/AuthGate";

import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نأسف لذلك. يرجى إعادة تحميل الصفحة أو المحاولة مجدداً.
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "منصة إدارة حلقات القرآن في اللواء 642" },
      { name: "description", content: "لوحة تحكم لإدارة بيانات طلاب الحلقات القرآنية" },
      { property: "og:title", content: "منصة إدارة حلقات القرآن في اللواء 642" },
      { name: "twitter:title", content: "منصة إدارة حلقات القرآن في اللواء 642" },
      { property: "og:description", content: "لوحة تحكم لإدارة بيانات طلاب الحلقات القرآنية" },
      { name: "twitter:description", content: "لوحة تحكم لإدارة بيانات طلاب الحلقات القرآنية" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/91652bac-ce0a-4dc9-9e4d-0d2096e00ce9/id-preview-709d6bcf--c68e50a6-5d76-4dda-af56-6941754593a0.lovable.app-1779121126477.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/91652bac-ce0a-4dc9-9e4d-0d2096e00ce9/id-preview-709d6bcf--c68e50a6-5d76-4dda-af56-6941754593a0.lovable.app-1779121126477.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" dir="rtl" richColors />
    </QueryClientProvider>
  );
}
