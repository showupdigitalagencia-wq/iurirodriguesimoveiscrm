import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { confirmarVisita } from "@/lib/visitas.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  visitaId: string | null;
  onClose: () => void;
  onConfirmed?: () => void;
};

export function ChecklistVisitaDialog({ open, visitaId, onClose, onConfirmed }: Props) {
  const [items, setItems] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const confirmFn = useServerFn(confirmarVisita);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "visita_checklist_items")
      .maybeSingle()
      .then(({ data }) => {
        const valor = (data?.valor ?? {}) as { items?: string[] };
        const list = Array.isArray(valor.items) ? valor.items.filter((s) => s && s.trim()) : [];
        setItems(list);
        setChecked(Object.fromEntries(list.map((i) => [i, false])));
        setLoading(false);
      });
  }, [open]);

  async function handleSave() {
    if (!visitaId) return;
    setSaving(true);
    try {
      const checklist = items.map((item) => ({ item, ok: !!checked[item] }));
      await confirmFn({ data: { visita_id: visitaId, comparecimento: "realizada", checklist } });
      toast.success("Visita confirmada com checklist");
      onConfirmed?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar checklist");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checklist da visita</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">
            Nenhum item de checklist configurado. A visita será apenas marcada como realizada.
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {items.map((item) => (
              <label key={item} className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/40">
                <Checkbox
                  checked={!!checked[item]}
                  onCheckedChange={(v) => setChecked((c) => ({ ...c, [item]: !!v }))}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">{item}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="gold" onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirmar visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
