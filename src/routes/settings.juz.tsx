import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentJuzManagerCard } from "@/components/StudentJuzManagerCard";

export const Route = createFileRoute("/settings/juz")({
  component: JuzSettingsPage,
});

function JuzSettingsPage() {
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
          <h1 className="font-bold text-sm sm:text-base">الأجزاء المتاحة للتسميع</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6">
        <StudentJuzManagerCard />
      </main>
    </div>
  );
}
