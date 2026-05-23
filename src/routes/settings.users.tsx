import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessRequestsCard } from "@/components/AccessRequestsCard";
import { NotificationEmailCard } from "@/components/AdminPanels";
import { CreateUserCard } from "@/components/CreateUserCard";
import { PlatformUsersCard } from "@/components/PlatformUsersCard";
import { TransferSuperAdminCard } from "@/components/TransferSuperAdminCard";
import { StudentLinkCard } from "@/components/StudentLinkCard";

export const Route = createFileRoute("/settings/users")({
  component: UsersSettingsPage,
});

function UsersSettingsPage() {
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

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6">
        <AccessRequestsCard />
        <NotificationEmailCard />
        <CreateUserCard />
        <PlatformUsersCard />
        <StudentLinkCard />
        <TransferSuperAdminCard />
      </main>
    </div>
  );
}
