import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPlatformUser } from "@/lib/admin-users.functions";
import { useIsAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { UserPlus } from "lucide-react";

export function CreateUserCard() {
  const isAdmin = useIsAdmin();
  const create = useServerFn(createPlatformUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      toast.error("كلمة المرور يجب أن تكون 10 أحرف على الأقل");
      return;
    }
    setBusy(true);
    try {
      const res = await create({ data: { email, password } });
      toast.success(res.updated ? "تم تحديث كلمة المرور للحساب" : "تم إنشاء الحساب");
      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">إنشاء حساب جديد</h2>
          <p className="text-xs text-muted-foreground">
            أنشئ حساباً بإيميل وكلمة مرور وسلّمها للمستخدم
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="newEmail" className="text-xs">البريد الإلكتروني</Label>
          <Input
            id="newEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="newPassword" className="text-xs">كلمة المرور (3 أحرف فأكثر)</Label>
          <Input
            id="newPassword"
            type="text"
            required
            minLength={3}
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "..." : "إنشاء"}
          </Button>
        </div>
      </form>
    </section>
  );
}
