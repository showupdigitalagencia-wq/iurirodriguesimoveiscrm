import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useHojeData } from "@/hooks/use-hoje-items";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  MessageCircle,
  Phone,
  Sparkles,
  Timer,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/hoje")({
  component: HojePage,
});

function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function tempoDesde(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
}

function whatsappLink(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const num = tel.replace(/\D/g, "");
  if (!num) return null;
  const full = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${full}`;
}

function HojePage() {
  const data = useHojeData();
  // Tick para o contador "tempo decorrido" atualizar
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const vazio =
    !data.plantao &&
    data.leadsSemContato.length === 0 &&
    data.visitas.length === 0 &&
    data.followup.length === 0 &&
    data.chaves.length === 0 &&
    data.candidatos.length === 0 &&
    data.reunioes.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-gold">
          <Zap className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Hoje</h1>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{hoje}</p>
      </header>

      {data.plantao && (
        <Card className="border-gold/40 bg-gradient-to-br from-gold/10 to-transparent">
          <CardContent className="py-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-gold" />
            <div className="flex-1">
              <div className="font-semibold">Você está de plantão hoje</div>
              <div className="text-xs text-muted-foreground">
                Novos leads do plantão serão atribuídos a você.
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/vendas/plantao">Ver plantão</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data.leadsSemContato.length > 0 && (
        <Section icon={<Timer className="h-4 w-4" />} title="Urgente — leads sem primeiro contato">
          <ul className="space-y-2">
            {data.leadsSemContato.map((l) => {
              const wa = whatsappLink(l.telefone);
              return (
                <li key={l.id} className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{l.nome}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <AlarmClock className="h-3 w-3" />
                      Atribuído há {tempoDesde(l.atribuido_em)} · sem resposta
                    </div>
                  </div>
                  {wa && (
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <a href={wa} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1" /> Responder agora
                      </a>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {data.visitas.length > 0 && (
        <Section icon={<CalendarDays className="h-4 w-4" />} title="Visitas de hoje">
          <ul className="space-y-2">
            {data.visitas.map((v) => {
              const passou = new Date(v.data_inicio).getTime() < Date.now();
              const pendente = passou && !v.comparecimento;
              return (
                <li key={v.id} className="rounded-lg border border-border/60 bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-gold w-14 shrink-0">{fmtHora(v.data_inicio)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{v.endereco ?? "Visita agendada"}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.comparecimento === "compareceu" && (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">Realizada</Badge>
                        )}
                        {v.comparecimento === "nao_compareceu" && (
                          <Badge variant="secondary" className="bg-rose-500/10 text-rose-700">Não compareceu</Badge>
                        )}
                        {!v.comparecimento && passou && (
                          <span className="text-amber-600">Horário já passou — confirme o resultado</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/vendas/agenda">Ver na agenda</Link>
                    </Button>
                    {pendente && (
                      <>
                        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" disabled>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Realizada
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-700 border-rose-300" disabled>
                          <XCircle className="h-4 w-4 mr-1" /> Não compareceu
                        </Button>
                      </>
                    )}
                  </div>
                  {pendente && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Confirme pelo módulo de Agenda.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {data.followup.length > 0 && (
        <Section icon={<AlarmClock className="h-4 w-4" />} title="Follow-up vencendo hoje">
          <ul className="space-y-2">
            {data.followup.map((l) => {
              const wa = whatsappLink(l.telefone);
              const dest = l.fonte === "vendas" ? "/vendas/leads" : "/leads";
              return (
                <li key={`${l.fonte}-${l.id}`} className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {l.nome}
                      <Badge variant="outline" className="text-[10px]">
                        {l.fonte === "vendas" ? "Vendas" : "Captação"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">Etapa: {l.etapa}</div>
                  </div>
                  {wa && (
                    <Button asChild size="sm" variant="outline">
                      <a href={wa} target="_blank" rel="noreferrer">
                        <Phone className="h-4 w-4 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link to={dest}>Abrir</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {data.chaves.length > 0 && (
        <Section icon={<KeyRound className="h-4 w-4" />} title="Chaves atrasadas">
          <ul className="space-y-2">
            {data.chaves.map((c) => (
              <li key={c.id} className="rounded-lg border border-rose-300/40 bg-rose-500/5 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {c.codigo ? `${c.codigo} · ` : ""}
                    {c.rua}
                    {c.numero ? `, ${c.numero}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.bairro ?? ""} · com você há {tempoDesde(c.chave_retirada_em)}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="border-rose-300 text-rose-700">
                  <Link to="/admin/chaves">Devolver agora</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.isExec && data.candidatos.length > 0 && (
        <Section icon={<UserPlus className="h-4 w-4" />} title="Captação — candidatos sem contato">
          <ul className="space-y-2">
            {data.candidatos.map((c) => {
              const wa = whatsappLink(c.telefone);
              return (
                <li key={c.id} className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.regiao ?? ""} · cadastrado há {tempoDesde(c.created_at)}
                    </div>
                  </div>
                  {wa && (
                    <Button asChild size="sm" variant="outline">
                      <a href={wa} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/admin/candidatos">Abrir</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {data.isExec && data.reunioes.length > 0 && (
        <Section icon={<Users className="h-4 w-4" />} title="Reuniões institucionais de hoje">
          <ul className="space-y-2">
            {data.reunioes.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3">
                <div className="text-sm font-bold text-gold w-14 shrink-0">{fmtHora(r.data_inicio)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.local ?? "Local não definido"} ·{" "}
                    <span className="text-foreground/80">
                      {r.candidatos_confirmados} candidato{r.candidatos_confirmados === 1 ? "" : "s"} confirmado
                      {r.candidatos_confirmados === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/agenda">Ver agenda</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}



      {vazio && !data.loading && (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">Nenhuma ação pendente agora.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}
