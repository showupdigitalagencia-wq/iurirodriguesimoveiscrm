import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { ETAPAS, canalNome, etapaHex, type LeadRow } from "@/lib/lead-helpers";
import { updateLeadEtapa, markFirstResponse } from "@/lib/leads.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone, MessageCircle } from "lucide-react";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { Termometro } from "@/components/termometro";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Negócios — Sistema NEXUS" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [, setTick] = useState(0);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const updateEtapa = useServerFn(updateLeadEtapa);
  const markFirst = useServerFn(markFirstResponse);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      setLeads((data as LeadRow[]) ?? []);
    }
    load();
    const ch = supabase.channel("pipeline-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, load).subscribe();
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function onDragEnd(event: DragEndEvent) {
    const leadId = event.active.id as string;
    const newEtapa = event.over?.id as LeadRow["etapa"] | undefined;
    if (!newEtapa) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa === newEtapa) return;
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, etapa: newEtapa } : l));
    try {
      await updateEtapa({ data: { id: leadId, etapa: newEtapa } });
      if (newEtapa === "em_atendimento" && !lead.first_response_at) {
        await markFirst({ data: { id: leadId } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Negócios</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1 hidden md:block">Arraste os leads entre as etapas.</p>
        <p className="text-muted-foreground text-xs mt-1 md:hidden">Deslize as colunas para o lado. Toque em um card para abrir.</p>
      </header>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0">
          {ETAPAS.map((etapa) => (
            <Column key={etapa.id} id={etapa.id} title={etapa.nome}
              leads={leads.filter((l) => l.etapa === etapa.id)}
              onOpen={setOpenLead} />
          ))}
        </div>
      </DndContext>
      <LeadDetailSheet leadId={openLead} onClose={() => setOpenLead(null)} backLabel="Voltar ao Pipeline" />
    </div>
  );
}

function Column({ id, title, leads, onOpen }: { id: string; title: string; leads: LeadRow[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hex = etapaHex(id as LeadRow["etapa"]);
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[85vw] sm:w-[300px] md:w-[280px] snap-center glass rounded-xl overflow-hidden transition-shadow ${isOver ? "ring-1 ring-primary/60 gold-glow" : ""}`}
    >
      <div
        className="relative flex items-center justify-between px-3 py-2.5 border-b border-border/40"
        style={{
          background: `linear-gradient(180deg, ${hex}22, transparent)`,
        }}
      >
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: hex, boxShadow: `0 0 12px ${hex}` }} />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/90">
          {title}
        </h3>
        <span
          className="text-[10px] font-medium rounded-full px-2 py-0.5 border"
          style={{ color: hex, borderColor: `${hex}55`, background: `${hex}15` }}
        >
          {leads.length}
        </span>
      </div>
      <div className="space-y-2 p-3">
        {leads.map((lead) => <Card key={lead.id} lead={lead} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function Card({ lead, onOpen }: { lead: LeadRow; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const hex = etapaHex(lead.etapa);
  const score = (lead as unknown as { score_temperatura: number | null }).score_temperatura ?? null;
  const temp = (lead as unknown as { temperatura: "frio" | "morno" | "quente" | null }).temperatura ?? null;
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: hex }}
      {...listeners}
      {...attributes}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onOpen(lead.id); } }}
      className={`relative bg-card/70 backdrop-blur-sm border border-border/60 border-l-[3px] rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-all ${isDragging ? "opacity-50 cursor-grabbing" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm truncate flex-1">{lead.nome}</div>
        {score !== null && <Termometro score={score} temperatura={temp} size="sm" />}
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
        <Phone className="h-3 w-3" /> {lead.telefone}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <MessageCircle className="h-3 w-3" /> {canalNome(lead.canal)}
      </div>
    </div>
  );
}
