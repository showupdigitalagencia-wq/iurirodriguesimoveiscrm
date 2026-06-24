import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useHojeBadge } from "@/hooks/use-hoje-items";
import { cn } from "@/lib/utils";

export function HojeIconButton({ className }: { className?: string }) {
  const total = useHojeBadge();
  return (
    <Link
      to="/hoje"
      aria-label={`Hoje${total > 0 ? ` — ${total} pendente(s)` : ""}`}
      className={cn(
        "relative inline-flex items-center justify-center h-10 w-10 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-accent [&.active]:text-gold",
        className,
      )}
      activeProps={{ className: "active" }}
    >
      <Zap className="h-5 w-5" />
      {total > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-sidebar text-[10px] font-bold flex items-center justify-center leading-none">
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
