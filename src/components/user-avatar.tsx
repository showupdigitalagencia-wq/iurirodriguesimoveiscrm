import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Avatar circular com fallback de iniciais. Usa <img> direto (signed URL). */
export function UserAvatar({
  name,
  url,
  className,
  fallbackClassName,
}: {
  name: string | null | undefined;
  url?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full overflow-hidden border border-gold/30 bg-gradient-to-br from-gold/30 to-gold/10 text-gold font-semibold shrink-0",
        className,
      )}
      aria-label={name ?? undefined}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className={cn("leading-none", fallbackClassName)}>{initials(name ?? "?")}</span>
      )}
    </span>
  );
}
