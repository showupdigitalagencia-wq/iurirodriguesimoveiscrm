import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CANAIS } from "@/lib/lead-helpers";

type Resp = { id: string; canal: string; nome: string; whatsapp: string };

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — CRM" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  const [resps, setResps] = useState<Resp[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("responsaveis").select("id, canal, nome, whatsapp").then(({ data }) => {
      setResps((data as Resp[]) ?? []);
    });
  }, []);

  async function save(r: Resp) {
    setSaving(r.id);
    const { error } = await supabase.from("responsaveis")
      .update({ nome: r.nome, whatsapp: r.whatsapp.replace(/\D/g, "") })
      .eq("id", r.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie os responsáveis por canal de atendimento.</p>
      </header>
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Responsáveis e WhatsApp</h2>
        {resps.map((r) => (
          <div key={r.id} className="grid md:grid-cols-[120px_1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Canal</Label>
              <div className="mt-1.5 px-3 py-2 bg-muted rounded-md text-sm">
                {CANAIS.find((c) => c.id === r.canal)?.nome ?? r.canal}
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={r.nome} onChange={(e) => setResps((p) => p.map((x) => x.id === r.id ? { ...x, nome: e.target.value } : x))} className="mt-1.5" />
            </div>
            <div>
              <Label>WhatsApp (com DDI 55)</Label>
              <Input value={r.whatsapp} onChange={(e) => setResps((p) => p.map((x) => x.id === r.id ? { ...x, whatsapp: e.target.value } : x))} placeholder="5521900000000" className="mt-1.5" />
            </div>
            <Button variant="gold" onClick={() => save(r)} disabled={saving === r.id}>
              {saving === r.id ? "..." : "Salvar"}
            </Button>
          </div>
        ))}
      </section>
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-2">Z-API</h2>
        <p className="text-sm text-muted-foreground">
          As credenciais Z-API (Instance ID, Token, Client Token) estão armazenadas como segredos seguros no backend e usadas automaticamente para enviar mensagens. Para atualizar, peça ao administrador para rotacionar os segredos.
        </p>
      </section>
    </div>
  );
}
