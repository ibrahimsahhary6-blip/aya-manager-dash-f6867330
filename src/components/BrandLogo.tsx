import logoUrl from "@/assets/logo.jpg";

export const BRAND_LOGO_URL = logoUrl;
export const BRAND_NAME = "منصة البناء القرآني";
export const BRAND_SUBTITLE = "وشؤون المساجد — اللواء 642";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
};

export function BrandLogo({ size = "md", className = "" }: { size?: Size; className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="شعار منصة البناء القرآني وشؤون المساجد"
      className={`${sizeMap[size]} rounded-xl object-cover ring-1 ring-primary/20 shadow-sm shrink-0 ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

export function BrandMark({
  title = BRAND_NAME,
  subtitle,
  size = "md",
}: {
  title?: string;
  subtitle?: string;
  size?: Size;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <BrandLogo size={size} />
      <div className="min-w-0">
        <h1 className="text-sm sm:text-base font-bold leading-tight truncate text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
