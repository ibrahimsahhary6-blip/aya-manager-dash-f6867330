import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, UserPlus, Users, ShieldCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CreateUserCard } from "@/components/CreateUserCard";
import { PlatformUsersCard } from "@/components/PlatformUsersCard";
import { TransferSuperAdminCard } from "@/components/TransferSuperAdminCard";
import { ManageStudentsPermissionCard } from "@/components/ManageStudentsPermissionCard";
import { useAdminAccess, useIsSuperAdmin } from "@/lib/roles";

export const Route = createFileRoute("/settings/users")({
  component: UsersSettingsPage,
});

function ItemHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 text-right flex-1">
      <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm sm:text-base">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 font-normal">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersSettingsPage() {
  const { allowed, isLoading } = useAdminAccess();
  const isSuper = useIsSuperAdmin();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }
  if (!allowed) {
    return <Navigate to="/settings" />;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/settings">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع إلى الضبط</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base">إدارة المستخدمين</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Accordion type="multiple" className="grid gap-3">
          <AccordionItem
            value="create"
            className="rounded-2xl border bg-card shadow-soft px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <ItemHeader
                icon={UserPlus}
                title="إنشاء حساب جديد"
                description="أنشئ حساباً بإيميل وكلمة مرور وسلّمها للمستخدم"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <CreateUserCard />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="users"
            className="rounded-2xl border bg-card shadow-soft px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <ItemHeader
                icon={Users}
                title="المستخدمون"
                description="عرض المستخدمين وإدارة أدوارهم وأقسامهم"
              />
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <PlatformUsersCard />
            </AccordionContent>
          </AccordionItem>

          {isSuper && (
            <>
              <AccordionItem
                value="perms"
                className="rounded-2xl border bg-card shadow-soft px-4 sm:px-5"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <ItemHeader
                    icon={ShieldCheck}
                    title="الصلاحيات"
                    description="تحكّم بصلاحيات إدارة الطلاب والسرايا لكل قسم"
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ManageStudentsPermissionCard />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="transfer"
                className="rounded-2xl border bg-card shadow-soft px-4 sm:px-5"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <ItemHeader
                    icon={Crown}
                    title="نقل ملكية المدير الأعلى"
                    description="تسليم صلاحيات المدير الأعلى لحساب آخر"
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <TransferSuperAdminCard />
                </AccordionContent>
              </AccordionItem>
            </>
          )}
        </Accordion>
      </main>
    </div>
  );
}
