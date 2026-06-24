import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, Mic } from "lucide-react";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function FeedAudio({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onLoaded = () => setDur(a.duration || 0);
    const onEnd = () => { setPlaying(false); setCur(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => null); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    const bar = barRef.current;
    if (!a || !bar || !dur) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * dur;
    setCur(a.currentTime);
  }

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-3">
        <audio ref={ref} src={src} preload="metadata" />
        <Button
          type="button"
          size="icon"
          onClick={toggle}
          className="h-11 w-11 rounded-full shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Mic className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">Áudio</span>
          </div>
          <div
            ref={barRef}
            onClick={seek}
            className="h-1.5 bg-emerald-900/10 dark:bg-emerald-100/10 rounded-full cursor-pointer relative"
          >
            <div
              className="absolute inset-y-0 left-0 bg-emerald-600 rounded-full transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-emerald-600 shadow-sm transition-[left] duration-150"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
            <span>{fmt(cur)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
