import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function AudioMessage({ src, duration, variant = "user" }: { src: string; duration?: number; variant?: "user" | "assistant" }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(duration ?? 0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onLoaded = () => {
      if (isFinite(a.duration) && a.duration > 0) setDur(a.duration);
    };
    const onEnd = () => { setPlaying(false); setCur(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  }

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  const isUser = variant === "user";

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/10 text-foreground",
        )}
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={cn("h-1 rounded-full overflow-hidden", isUser ? "bg-primary-foreground/25" : "bg-foreground/15")}>
          <div
            className={cn("h-full transition-[width] duration-100", isUser ? "bg-primary-foreground" : "bg-foreground/70")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={cn("text-[11px] tabular-nums", isUser ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {fmt(playing || cur > 0 ? cur : dur)}
        </div>
      </div>
      <audio ref={ref} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
