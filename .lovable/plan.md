## الهدف
تحويل الإعدادات العامة الحالية إلى إعدادات **لكل قسم**، فتفعّل الميزات لقسم دون آخر.

## الميزات القابلة للتحكم لكل قسم
1. السماح للمديرين بإضافة/حذف الطلاب والسرايا.
2. السماح للمستخدمين بإضافة/حذف الطلاب والسرايا.
3. تفعيل الأجزاء الإضافية (28 و 29) للتسميع لطلاب هذا القسم.

الأعلامة العامة الحالية في `app_settings` تبقى كـ **قيمة افتراضية** عندما لا يكون للقسم إعداد مخصص. المدير الأعلى يتجاوز كل شيء دائماً.

## تغييرات قاعدة البيانات
- جدول جديد `department_settings`:
  - `department_id` (PK, FK → departments)
  - `admins_can_manage_students` boolean (nullable → يرث من الإعداد العام)
  - `users_can_manage_students` boolean (nullable → يرث)
  - `extra_juz_enabled` boolean default true
  - `updated_at`
- تحديث الدالة `can_admin_manage_students(_user_id)` لتقبل معامل قسم اختياري وتقرأ من `department_settings` أولاً ثم `app_settings` كاحتياطي.
- إضافة دالة `department_extra_juz_enabled(_department_id)`.
- سياسات RLS: قراءة للجميع (`authenticated`)، كتابة لـ super_admin فقط.
- GRANTs مناسبة.

## تغييرات الواجهة
### 1. `ManageStudentsPermissionCard`
تحويلها إلى بطاقة تعرض قائمة الأقسام؛ لكل قسم صفّان (Switch للمدراء + Switch للمستخدمين). زر "استخدم الإعداد العام" لإرجاع القيمة إلى null.

### 2. `StudentJuzManagerCard`
إضافة قسم علوي: لكل قسم مفتاح واحد "تفعيل الأجزاء 28/29 لهذا القسم". عند التعطيل، لا تظهر أزرار التفعيل للطلاب داخل هذا القسم، ويُخفى التبديل من صفحة الطالب.

### 3. `src/lib/roles.ts`
- `useCanManageStudents(departmentId?)` — يقرأ إعداد القسم ثم يرجع للعام.
- `useDepartmentExtraJuzEnabled(departmentId)`.

### 4. `students.$studentId.tsx`
إخفاء مفاتيح الجزء 28/29 إن كانت الميزة معطّلة للقسم الذي ينتمي إليه الطالب.

## ملاحظات
- لا تغيير على سلوك المدير الأعلى.
- الإعدادات العامة القديمة تبقى تعمل كافتراضي للأقسام التي لم تُضبط.
- الواجهة تظهر فقط للـ super_admin (كما هي الآن).
