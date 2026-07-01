import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportReportDialog } from "@/components/ExportReportDialog";
import { BackupRestore } from "@/components/BackupRestore";
import { AuditLogCard } from "@/components/AuditLogCard";
import { useIsAdmin, useIsSuperAdmin } from "@/lib/roles";

export const Route = createFileRoute("/settings/system")({
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const canSeeBackups = isAdmin || isSuper;
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
          <h1 className="font-bold text-sm sm:text-base">أدوات النظام</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6">
        <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">التقارير وسلة المحذوفات</h2>
              <p className="text-xs text-muted-foreground">
                تصدير بيانات السرايا وإدارة المحذوفات
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ExportReportDialog />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/trash">
                <Trash className="h-4 w-4" />
                <span>سلة المحذوفات</span>
              </Link>
            </Button>
          </div>
        </section>

        <AuditLogCard />
        {canSeeBackups && <BackupRestore />}
      </main>
    </div>
  );
}
