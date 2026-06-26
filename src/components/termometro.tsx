import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

export type Tendencia = "subiu" | "desceu" | null;

export function tendenciaFromTemperaturas(
  atual?: string | null,
  anterior?: string | null,
): Tendencia {
  if (!atual || !anterior || atual === anterior) return null;
  const rank: Record<string, number> = { frio: 1, morno: 2, quente: 3 };
  const a = rank[atual] ?? 0;
  const b = rank[anterior] ?? 0;
  if (a > b) return "subiu";
  if (a < b) return "desceu";
  return null;
}

export type Temperatura = "frio" | "morno" | "quente";

export function temperaturaFromScore(score: number, frioMax = 39, mornoMax = 69): Temperatura {
  if (score <= frioMax) return "frio";
  if (score <= mornoMax) return "morno";
  return "quente";
}

const COLORS: Record<Temperatura, { fill: string; track: string; text: string; ring: string; label: string }> = {
  frio: {
    fill: "bg-gradient-to-t from-sky-500 to-sky-300",
    track: "bg-sky-100 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-300/60 dark:ring-sky-500/30",
    label: "Frio",
  },
  morno: {
    fill: "bg-gradient-to-t from-amber-500 to-amber-300",
    track: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    ring: "ring-amber-300/60 dark:ring-amber-500/30",
    label: "Morno",
  },
  quente: {
    fill: "bg-gradient-to-t from-red-600 to-red-400",
    track: "bg-red-100 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    ring: "ring-red-300/60 dark:ring-red-500/30",
    label: "Quente",
  },
};

type Props = {
  score?: number | null;
  temperatura?: Temperatura | null;
  tendencia?: Tendencia;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

/**
 * Termômetro visual real: bulbo embaixo + tubo que preenche conforme o score.
 */
export function Termometro({ score, temperatura, size = "sm", showLabel = false, className }: Props) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const temp = temperatura ?? temperaturaFromScore(s);
  const c = COLORS[temp];

  const dims = {
    sm: { tubeH: 28, tubeW: 6, bulb: 10, fontScore: "text-[10px]", fontLabel: "text-[10px]" },
    md: { tubeH: 56, tubeW: 10, bulb: 16, fontScore: "text-xs", fontLabel: "text-xs" },
    lg: { tubeH: 96, tubeW: 14, bulb: 22, fontScore: "text-sm", fontLabel: "text-sm" },
  }[size];

  const fillPct = s; // 0–100

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} title={`${c.label} • ${s}/100`}>
      <div className="relative flex flex-col items-center" style={{ width: dims.bulb }}>
        {/* tube */}
        <div
          className={cn("relative overflow-hidden rounded-full ring-1", c.track, c.ring)}
          style={{ width: dims.tubeW, height: dims.tubeH }}
        >
          <div
            className={cn("absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-500", c.fill)}
            style={{ height: `${fillPct}%` }}
          />
        </div>
        {/* bulb */}
        <div
          className={cn("rounded-full ring-1 -mt-1", c.fill, c.ring)}
          style={{ width: dims.bulb, height: dims.bulb }}
        />
      </div>
      {showLabel && (
        <div className="flex flex-col leading-tight">
          <span className={cn("font-semibold", dims.fontLabel, c.text)}>{c.label}</span>
          <span className={cn("text-muted-foreground", dims.fontScore)}>{s}/100</span>
        </div>
      )}
    </div>
  );
}

export function TemperaturaBadge({ score, temperatura, className }: Pick<Props, "score" | "temperatura" | "className">) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const temp = temperatura ?? temperaturaFromScore(s);
  const c = COLORS[temp];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", c.text, c.ring, "border-current/20", className)}>
      <Termometro score={s} temperatura={temp} size="sm" />
      {c.label} · {s}
    </span>
  );
}
