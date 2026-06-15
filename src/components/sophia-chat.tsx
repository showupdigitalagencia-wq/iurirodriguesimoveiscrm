import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sophiaChat } from "@/lib/sophia.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Send, Loader2, Bot, X, ArrowLeft, Mic, MicOff, ImagePlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string; imageDataUrl?: string };

type SRInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
type SRConstructor = new () => SRInstance;

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

// (SpeechRecognition types declared above)

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function LauraChat() {
  const fn = useServerFn(sophiaChat);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Oi! Eu sou a **Laura** 👋 Como posso te ajudar hoje?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SRInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string, imageDataUrl?: string) {
    const content = text.trim();
    if ((!content && !imageDataUrl) || loading) return;
    const finalContent = content || "(imagem enviada)";
    const userMsg: Msg = { role: "user", content: finalContent, imageDataUrl };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    try {
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

  function toggleRecording() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) {
      toast.error("Seu navegador não suporta gravação de voz. Use Chrome/Safari recentes.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        // results[i].isFinal not in our minimal type; fold all into final at end
        interim += t;
      }
      finalText = interim;
      setInput(interim);
    };
    rec.onerror = (e) => {
      toast.error(`Erro de gravação: ${e.error ?? "desconhecido"}`);
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      const txt = finalText.trim();
      if (txt) void send(txt, pendingImage ?? undefined);
    };
    recRef.current = rec;
    setRecording(true);
    try {
      rec.start();
    } catch {
      setRecording(false);
    }
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
                {m.role === "assistant" ? (
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
                disabled={loading}
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
          onSubmit={(e) => { e.preventDefault(); send(input, pendingImage ?? undefined); }}
          className="border-t p-3 flex items-center gap-2 shrink-0 bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickImage}
          />
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
          <Button
            type="button"
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            onClick={toggleRecording}
            disabled={loading}
            className="rounded-full h-11 w-11 shrink-0"
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
          >
            {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? "Ouvindo…" : "Pergunte algo à Laura…"}
            className="flex-1 min-w-0 bg-background border rounded-full px-4 h-11 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || (!input.trim() && !pendingImage)}
            className="rounded-full h-11 w-11 shrink-0"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
