// Executivos hardcoded para a Landing Page de captação de corretores.
// O `ref` é o slug recebido via ?ref= na URL.

export type CaptacaoExecutivo = {
  ref: "barra" | "recreio" | "belford" | "mesquita";
  nome: string;
  regiao: string;
  descricao: string;
  whatsapp: string; // formato internacional sem +
};

export const CAPTACAO_EXECUTIVOS: CaptacaoExecutivo[] = [
  {
    ref: "barra",
    nome: "Robson",
    regiao: "Barra da Tijuca",
    descricao:
      "Especialista no Rio de Janeiro. Acompanha cada corretor de perto para destravar resultados consistentes.",
    whatsapp: "5521980893621",
  },
  {
    ref: "recreio",
    nome: "Fabíola",
    regiao: "Recreio dos Bandeirantes",
    descricao:
      "Lidera a operação no Recreio com foco em performance, treinamento e suporte ao corretor do início ao fechamento.",
    whatsapp: "5521991002856",
  },
  {
    ref: "belford",
    nome: "Renata",
    regiao: "Belford Roxo",
    descricao:
      "Conhece cada rua da Baixada e abre as portas certas para corretores que querem volume e velocidade de venda.",
    whatsapp: "5521959370160",
  },
  {
    ref: "mesquita",
    nome: "Denise",
    regiao: "Mesquita",
    descricao:
      "Constrói times em Mesquita e região com método, mentoria e leads prontos para atendimento todos os dias.",
    whatsapp: "5521998305218",
  },
];

export const CAPTACAO_REFS = CAPTACAO_EXECUTIVOS.map((e) => e.ref) as readonly CaptacaoExecutivo["ref"][];

export function findExecutivoByRef(ref: string | null | undefined): CaptacaoExecutivo | null {
  if (!ref) return null;
  return CAPTACAO_EXECUTIVOS.find((e) => e.ref === ref) ?? null;
}

export const CAPTACAO_REGIOES_MARQUEE = [
  "Barra da Tijuca",
  "Recreio",
  "Jacarepaguá",
  "Zona Sul",
  "Belford Roxo",
  "Nilópolis",
  "Mesquita",
  "Nova Iguaçu",
  "Centro",
  "Zona Norte",
  "Zona Oeste",
];

export const CAPTACAO_STATS = [
  { n: "40+", l: "Corretores ativos" },
  { n: "4", l: "Regiões atendidas" },
  { n: "50+", l: "Leads novos por semana" },
];

export const CAPTACAO_WHATSAPP_TEMPLATE = (link: string) =>
  `Olá! 👋 Conheça o Ecossistema Nexus — o time de corretores mais moderno do Rio de Janeiro.\n\nAcesse e descubra como fazer parte:\n${link}`;
