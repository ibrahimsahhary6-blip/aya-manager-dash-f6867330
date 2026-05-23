import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Layers,
  Users,
  Wrench,
  UserCircle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings/")({
  component: SettingsMenuPage,
});

type MenuItem = {
  to: "/settings/groups" | "/settings/users" | "/settings/system" | "/settings/account";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: MenuItem[] = [
  {
    to: "/settings/groups",
    title: "إدارة المجموعات",
    description: "إضافة وتعديل الكتائب والسرايا",
    icon: Layers,
  },
  {
    to: "/settings/users",
    title: "إدارة المستخدمين",
    description: "الموافقة على المستخدمين الجدد وإعدادات الإدارة",
    icon: Users,
  },
  {
    to: "/settings/system",
    title: "أدوات النظام",
    description: "تصدير التقارير، سلة المحذوفات، النسخ الاحتياطي",
    icon: Wrench,
  },
  {
    to: "/settings/account",
    title: "الحساب الشخصي",
    description: "بيانات الحساب وتغيير كلمة المرور",
    icon: UserCircle,
  },
];

function SettingsMenuPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowRight className="h-4 w-4" />
              <span>العودة</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base">الضبط</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ul className="grid gap-3 sm:gap-4">
          {items.map(({ to, title, description, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex items-center gap-4 p-4 sm:p-5 bg-card border rounded-2xl shadow-soft hover:bg-accent/40 hover:border-primary/40 transition-colors"
              >
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base sm:text-lg">{title}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {description}
                  </p>
                </div>
                <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
