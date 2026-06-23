import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { aplicarVariaveis, abrirWhatsAppComTemplate, type TemplateVars } from "@/lib/mensagem-templates";

type Template = { id: string; titulo: string; conteudo: string; escopo: "pessoal" | "global" };

type Props = {
  open: boolean;
  onClose: () => void;
  telefone: string | null | undefined;
  vars: TemplateVars;
};

export function MensagemTemplatesDialog({ open, onClose, telefone, vars }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedId(null);
    setPreview("");
    supabase
      .from("mensagem_templates")
      .select("id, titulo, conteudo, escopo")
      .order("escopo", { ascending: true })
      .order("titulo", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setTemplates((data ?? []) as Template[]);
        setLoading(false);
      });
  }, [open]);

  function selecionar(t: Template) {
    setSelectedId(t.id);
    setPreview(aplicarVariaveis(t.conteudo, vars));
  }

  function enviar() {
    const tel = telefone ?? "";
    if (!tel) { toast.error("Lead sem telefone"); return; }
    if (!preview.trim()) { toast.error("Mensagem vazia"); return; }
    if (abrirWhatsAppComTemplate(tel, preview)) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar mensagem por WhatsApp</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando templates...
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum template ainda. Crie em Configurações &rsaquo; Minha Conta.
                </p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selecionar(t)}
                    className={`w-full text-left rounded-md border p-2 hover:bg-muted/50 transition ${
                      selectedId === t.id ? "border-primary bg-muted/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{t.titulo}</span>
                      <Badge variant={t.escopo === "global" ? "secondary" : "outline"} className="text-[10px]">
                        {t.escopo === "global" ? "Global" : "Meu"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{t.conteudo}</p>
                  </button>
                ))
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Preview (editável)</label>
              <Textarea
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                rows={10}
                placeholder="Selecione um template para começar..."
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground">
                Variáveis não preenchidas permanecem como {"{chave}"}.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="gold" onClick={enviar} disabled={!preview.trim() || !telefone}>
            <MessageCircle className="h-4 w-4 mr-1" /> Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
