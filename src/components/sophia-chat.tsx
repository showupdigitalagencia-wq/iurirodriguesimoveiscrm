import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sophiaChat } from "@/lib/sophia.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Send, Loader2, Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quem está livre na Barra agora?",
  "Quantos leads temos hoje?",
  "Me dê um relatório rápido da semana",
];

export function SophiaChat() {
  const fn = useServerFn(sophiaChat);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Oi! Eu sou a **Sophia** 👋 Como posso te ajudar hoje?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fn({ data: { messages: next.slice(-20) } });
      setMessages((m) => [...m, { role: "assistant", content: (res as { reply: string }).reply || "..." }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Desculpe, tive um erro: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full shadow-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white"
          aria-label="Abrir Sophia"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="border-b p-4 flex-row items-center gap-3 space-y-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="text-base">Sophia</SheetTitle>
            <div className="text-xs text-muted-foreground">Assistente IA do Sistema Nexus</div>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sophia está pensando…
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs rounded-full border px-3 py-1.5 hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t p-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo à Sophia…"
            className="flex-1 bg-background border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="rounded-full">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
