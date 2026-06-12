import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { REGIOES, maskPhone } from "@/lib/lead-helpers";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/formulario")({
  head: () => ({
    meta: [
      { title: "Fale conosco — Iuri Rodrigues Imóveis" },
      { name: "description", content: "Encontre o imóvel ideal no Rio de Janeiro com a Iuri Rodrigues Imóveis." },
      { property: "og:title", content: "Fale conosco — Iuri Rodrigues Imóveis" },
      { property: "og:description", content: "Encontre o imóvel ideal no Rio de Janeiro." },
    ],
  }),
  component: FormularioPage,
});

function FormularioPage() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [isCorretor, setIsCorretor] = useState(false);
  const [regiao, setRegiao] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get("nome") ?? ""),
      telefone: telefone.replace(/\D/g, ""),
      email: String(fd.get("email") ?? ""),
      is_corretor: isCorretor,
      creci: isCorretor ? String(fd.get("creci") ?? "") : "",
      regiao,
      tipo_imovel: String(fd.get("tipo_imovel") ?? ""),
      faixa_valor: String(fd.get("faixa_valor") ?? ""),
      observacoes: String(fd.get("observacoes") ?? ""),
    };
    if (!payload.nome || !payload.telefone || !payload.regiao) {
      toast.error("Preencha nome, telefone e região.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao enviar");
      }
      setEnviado(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-10 shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-gold" />
          <h1 className="mt-6 text-2xl font-semibold">Recebemos seu contato</h1>
          <p className="mt-3 text-muted-foreground">Nossa equipe entrará em contato em breve via WhatsApp. Obrigado!</p>
        </div>
        <Toaster richColors position="top-right" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-10">
          <div className="inline-block px-4 py-1 rounded-full bg-gold/15 text-gold-foreground text-xs uppercase tracking-[0.2em] font-semibold mb-4">
            Iuri Rodrigues Imóveis
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Encontre o imóvel ideal no Rio</h1>
          <p className="mt-3 text-muted-foreground">Preencha o formulário e nossa equipe entrará em contato.</p>
        </header>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <div>
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" name="nome" required className="mt-1.5" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <Input id="telefone" required value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(21) 99999-9999" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" className="mt-1.5" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="corretor" checked={isCorretor} onCheckedChange={(v) => setIsCorretor(v === true)} />
            <Label htmlFor="corretor" className="font-normal cursor-pointer">Sou corretor parceiro</Label>
          </div>
          {isCorretor && (
            <div>
              <Label htmlFor="creci">CRECI *</Label>
              <Input id="creci" name="creci" required className="mt-1.5" placeholder="Ex: RJ-12345" />
            </div>
          )}

          <div>
            <Label htmlFor="regiao">Região de interesse *</Label>
            <Select value={regiao} onValueChange={setRegiao}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione a região" /></SelectTrigger>
              <SelectContent>
                {REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo_imovel">Tipo de imóvel</Label>
              <Input id="tipo_imovel" name="tipo_imovel" className="mt-1.5" placeholder="Apartamento, casa…" />
            </div>
            <div>
              <Label htmlFor="faixa_valor">Faixa de valor</Label>
              <Input id="faixa_valor" name="faixa_valor" className="mt-1.5" placeholder="Até R$ 800 mil" />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" rows={4} className="mt-1.5" />
          </div>

          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Quero ser contatado"}
          </Button>
        </form>
      </div>
      <Toaster richColors position="top-right" />
    </main>
  );
}
