import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Player de vídeo estilo Instagram/TikTok:
 * - autoplay, loop, muted por padrão (necessário pra autoplay funcionar no browser)
 * - botão flutuante de som
 * - clica no vídeo = play/pause
 * - propaga onDoubleClick pro pai (curtir)
 */
export function FeedVideo({
  src,
  onDoubleClick,
}: {
  src: string;
  onDoubleClick?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);

  // pausa quando sai do viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) {
          el.play().catch(() => null);
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => null);
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="relative bg-black">
      <video
        ref={ref}
        src={src}
        className="w-full max-h-[720px] object-contain mx-auto"
        muted={muted}
        loop
        playsInline
        autoPlay
        onClick={togglePlay}
        onDoubleClick={onDoubleClick}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/55 backdrop-blur grid place-items-center text-white hover:bg-black/75 transition"
        aria-label={muted ? "Ativar som" : "Silenciar"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      {!playing && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/20 cursor-pointer"
        >
          <div className="h-14 w-14 rounded-full bg-black/55 grid place-items-center text-white text-xl">▶</div>
        </div>
      )}
    </div>
  );
}
