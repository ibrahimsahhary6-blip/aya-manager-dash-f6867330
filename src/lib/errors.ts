// Maps backend/PostgREST errors to safe Arabic messages for end users.
// Always log the full error to the console; only return generic text.

const GENERIC = "حدث خطأ، يرجى المحاولة مجدداً";

const CODE_MESSAGES: Record<string, string> = {
  "23505": "هذا الاسم موجود مسبقاً",
  "23503": "لا يمكن إتمام العملية بسبب ارتباط هذا السجل ببيانات أخرى",
  "23502": "بعض الحقول المطلوبة فارغة",
  "23514": "القيمة المُدخلة غير صالحة",
  "PGRST301": "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً",
  "PGRST116": "السجل غير موجود",
  "42501": "ليس لديك صلاحية لإجراء هذه العملية",
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "بيانات الدخول غير صحيحة",
  email_not_confirmed: "يرجى تأكيد البريد الإلكتروني أولاً",
  user_already_exists: "هذا الحساب موجود مسبقاً",
  weak_password: "كلمة المرور ضعيفة جداً",
  over_email_send_rate_limit: "تم تجاوز الحد المسموح، حاول لاحقاً",
};

export function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as { code?: string; status?: number; name?: string };
    console.error("[error]", err);
    if (anyErr.code && CODE_MESSAGES[anyErr.code]) return CODE_MESSAGES[anyErr.code];
    if (anyErr.code && AUTH_MESSAGES[anyErr.code]) return AUTH_MESSAGES[anyErr.code];
    if (anyErr.status === 401) return "غير مصرّح، يرجى تسجيل الدخول";
    if (anyErr.status === 403) return "ليس لديك صلاحية لإجراء هذه العملية";
    if (anyErr.status === 404) return "السجل غير موجود";
  } else {
    console.error("[error]", err);
  }
  return GENERIC;
}
