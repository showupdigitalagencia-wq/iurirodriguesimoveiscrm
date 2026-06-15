import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sophiaChat } from "@/lib/sophia.functions";
import { sophiaTranscribe } from "@/lib/sophia-transcribe.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Send, Loader2, Bot, X, ArrowLeft, Mic, ImagePlus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AudioMessage } from "./audio-message";

type Msg = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
};

const QUICK_ACTIONS = [
  "📊 Relatório do dia",
  "📊 Relatório da semana",
  "📊 Relatório do mês",
  "👥 Corretores disponíveis hoje",
  "📋 Quantos leads hoje?",
  "🏠 Imóveis disponíveis",
  "📅 Próximas reuniões",
  "⚡ Leads sem atendimento",
];

async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const url = await fileToDataUrl(blob);
  const i = url.indexOf(",");
  return i >= 0 ? url.slice(i + 1) : url;
}

function pickMime(): { mime: string; fmt: "webm" | "mp4" | "ogg" } {
  const MR = (typeof window !== "undefined" ? (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder : undefined);
  if (MR?.isTypeSupported?.("audio/webm;codecs=opus")) return { mime: "audio/webm;codecs=opus", fmt: "webm" };
  if (MR?.isTypeSupported?.("audio/webm")) return { mime: "audio/webm", fmt: "webm" };
  if (MR?.isTypeSupported?.("audio/mp4")) return { mime: "audio/mp4", fmt: "mp4" };
  if (MR?.isTypeSupported?.("audio/ogg")) return { mime: "audio/ogg", fmt: "ogg" };
  return { mime: "", fmt: "webm" };
}

export function LauraChat() {
  const fn = useServerFn(sophiaChat);
  const transcribe = useServerFn(sophiaTranscribe);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Oi! Eu sou a **Laura** 👋 Como posso te ajudar hoje?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recCancel, setRecCancel] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startXRef = useRef<number | null>(null);
  const startTRef = useRef<number>(0);
  const cancelRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fmtRef = useRef<"webm" | "mp4" | "ogg">("webm");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string, opts?: { imageDataUrl?: string; audioUrl?: string; audioDuration?: number }) {
    const content = text.trim();
    if ((!content && !opts?.imageDataUrl && !opts?.audioUrl) || loading) return;
    const finalContent = content || (opts?.audioUrl ? "🎤 Mensagem de voz" : "(imagem enviada)");
    const userMsg: Msg = {
      role: "user",
      content: finalContent,
      imageDataUrl: opts?.imageDataUrl,
      audioUrl: opts?.audioUrl,
      audioDuration: opts?.audioDuration,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    try {
      // Server only sees text + optional image. Audio was already transcribed into `content`.
      const payload = next.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.imageDataUrl ? { imageDataUrl: m.imageDataUrl } : {}),
      }));
      const res = await fn({ data: { messages: payload } });
      setMessages((m) => [...m, { role: "assistant", content: (res as { reply: string }).reply || "..." }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Desculpe, tive um erro: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function cleanupRecording() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setRecElapsed(0);
    setRecCancel(false);
    startXRef.current = null;
  }

  async function startRecording(clientX: number) {
    if (recording || loading) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Gravação de áudio não suportada neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mime, fmt } = pickMime();
      fmtRef.current = fmt;
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        const elapsedMs = Date.now() - startTRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const cancelled = cancelRef.current;
        cleanupRecording();
        if (cancelled || blob.size < 800 || elapsedMs < 500) return;
        const duration = elapsedMs / 1000;
        const audioUrl = URL.createObjectURL(blob);
        // Optimistic bubble while we transcribe + answer
        setLoading(true);
        const placeholder: Msg = { role: "user", content: "🎤 Mensagem de voz", audioUrl, audioDuration: duration };
        const next = [...messages, placeholder];
        setMessages(next);
        try {
          const base64 = await blobToBase64(blob);
          const { text } = (await transcribe({ data: { audioBase64: base64, format: fmtRef.current } })) as { text: string };
          const transcript = text.trim();
          // Replace placeholder with transcribed text (keep audio)
          setMessages((curr) => {
            const copy = [...curr];
            const idx = copy.findIndex((m) => m.audioUrl === audioUrl);
            if (idx >= 0) copy[idx] = { ...copy[idx], content: transcript || "🎤 Mensagem de voz" };
            return copy;
          });
          if (!transcript) {
            setMessages((m) => [...m, { role: "assistant", content: "Não consegui entender o áudio. Pode repetir?" }]);
            setLoading(false);
            return;
          }
          // Send to Laura
          const payload = [...next.slice(0, -1), { ...placeholder, content: transcript }].slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
          }));
          const res = await fn({ data: { messages: payload } });
          setMessages((m) => [...m, { role: "assistant", content: (res as { reply: string }).reply || "..." }]);
        } catch (e) {
          setMessages((m) => [...m, { role: "assistant", content: `Não consegui processar o áudio: ${(e as Error).message}` }]);
        } finally {
          setLoading(false);
        }
      };
      startTRef.current = Date.now();
      startXRef.current = clientX;
      setRecording(true);
      setRecElapsed(0);
      tickRef.current = setInterval(() => setRecElapsed((s) => s + 0.1), 100);
      rec.start();
    } catch {
      toast.error("Permita o acesso ao microfone para gravar áudio.");
      cleanupRecording();
    }
  }

  function moveRecording(clientX: number) {
    if (!recording || startXRef.current == null) return;
    const dx = startXRef.current - clientX;
    setRecCancel(dx > 80);
  }

  function stopRecording(commit: boolean) {
    if (!recording || !recRef.current) return;
    cancelRef.current = !commit || recCancel;
    try { recRef.current.stop(); } catch { cleanupRecording(); }
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setPendingImage(url);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full shadow-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white"
          aria-label="Abrir Laura"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-md flex flex-col p-0 gap-0 h-[100dvh] max-h-[100dvh] border-0 sm:border-l inset-0 sm:inset-y-0 sm:right-0 sm:left-auto"
      >
        <SheetTitle className="sr-only">Laura — Assistente IA</SheetTitle>

        {/* Header */}
        <div
          className="border-b px-2 py-2 flex items-center gap-2 shrink-0 bg-background sticky top-0 z-10"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setOpen(false)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold leading-tight truncate">Laura</div>
            <div className="text-xs text-muted-foreground truncate">Assistente IA do Sistema Nexus</div>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setOpen(false)} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {m.imageDataUrl && (
                  <img
                    src={m.imageDataUrl}
                    alt="anexo"
                    className="mb-2 rounded-lg max-h-48 w-auto object-cover"
                  />
                )}
                {m.audioUrl ? (
                  <AudioMessage src={m.audioUrl} duration={m.audioDuration} variant={m.role === "user" ? "user" : "assistant"} />
                ) : m.role === "assistant" ? (
                  <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_a]:underline [&_a]:text-primary [&_h1]:text-base [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:font-semibold [&_h3]:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laura está pensando…
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-2 pt-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading || recording}
                className="text-xs whitespace-nowrap rounded-full border px-3 py-2 hover:bg-muted active:bg-muted transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Pending image preview */}
        {pendingImage && (
          <div className="px-3 pt-2 shrink-0">
            <div className="relative inline-block">
              <img src={pendingImage} alt="preview" className="h-20 w-20 object-cover rounded-lg border" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border flex items-center justify-center"
                aria-label="Remover imagem"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input, { imageDataUrl: pendingImage ?? undefined }); }}
          className="border-t p-3 flex items-center gap-2 shrink-0 bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePickImage}
          />
          {recording ? (
            <div className="flex-1 flex items-center gap-3 h-11 px-4 rounded-full bg-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm tabular-nums">
                {Math.floor(recElapsed / 60)}:{String(Math.floor(recElapsed % 60)).padStart(2, "0")}
              </span>
              <span className={cn("text-xs flex items-center gap-1 ml-auto transition-colors", recCancel ? "text-red-500 font-medium" : "text-muted-foreground")}>
                <Trash2 className="h-3.5 w-3.5" />
                {recCancel ? "Solte para cancelar" : "← deslize para cancelar"}
              </span>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded-full h-11 w-11 shrink-0"
                aria-label="Anexar imagem"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo à Laura…"
                className="flex-1 min-w-0 bg-background border rounded-full px-4 h-11 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </>
          )}
          {input.trim() || pendingImage ? (
            <Button
              type="submit"
              size="icon"
              disabled={loading}
              className="rounded-full h-11 w-11 shrink-0"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              disabled={loading}
              className={cn(
                "rounded-full h-11 w-11 shrink-0 select-none touch-none",
                recording && (recCancel ? "bg-red-500 hover:bg-red-500" : "bg-red-500 hover:bg-red-500 scale-110"),
              )}
              aria-label="Segurar para gravar"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                void startRecording(e.clientX);
              }}
              onPointerMove={(e) => moveRecording(e.clientX)}
              onPointerUp={() => stopRecording(true)}
              onPointerCancel={() => stopRecording(false)}
              onPointerLeave={(e) => { if (recording && e.buttons === 0) stopRecording(true); }}
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
