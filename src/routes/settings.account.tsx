import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountCard } from "@/components/AccountCard";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";

export const Route = createFileRoute("/settings/account")({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/settings">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع إلى الضبط</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base">الحساب الشخصي</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6">
        <AccountCard />
        <ChangePasswordCard />
      </main>
    </div>
  );
}
