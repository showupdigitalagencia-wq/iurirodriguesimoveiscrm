import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema NEXUS" },
      { name: "description", content: "Plataforma de gestão de leads da Iuri Rodrigues Imóveis." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center">
        <div className="inline-block px-4 py-1 rounded-full bg-gold/15 text-gold-foreground text-xs uppercase tracking-[0.3em] font-semibold">
          Iuri Rodrigues Imóveis
        </div>
        <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">Sistema NEXUS</h1>
        <p className="mt-4 text-muted-foreground">Captação, distribuição e acompanhamento de leads com SLA, pipeline visual e relatórios.</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button variant="gold" size="lg" asChild><Link to="/auth">Acessar Sistema</Link></Button>
        </div>
      </div>
    </main>
  );
}
