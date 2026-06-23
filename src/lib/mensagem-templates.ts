export type TemplateVars = {
  nome_lead?: string | null;
  primeiro_nome_lead?: string | null;
  telefone_lead?: string | null;
  nome_corretor?: string | null;
  imovel_endereco?: string | null;
  imovel_codigo?: string | null;
  data_visita?: string | null;
  hora_visita?: string | null;
};

export const VARIAVEIS_DISPONIVEIS: { chave: keyof TemplateVars; descricao: string }[] = [
  { chave: "nome_lead", descricao: "Nome completo do lead" },
  { chave: "primeiro_nome_lead", descricao: "Primeiro nome do lead" },
  { chave: "telefone_lead", descricao: "Telefone do lead" },
  { chave: "nome_corretor", descricao: "Seu nome (corretor logado)" },
  { chave: "imovel_endereco", descricao: "Endereço do imóvel" },
  { chave: "imovel_codigo", descricao: "Código do imóvel" },
  { chave: "data_visita", descricao: "Data da próxima visita" },
  { chave: "hora_visita", descricao: "Hora da próxima visita" },
];

export function aplicarVariaveis(conteudo: string, vars: TemplateVars): string {
  return conteudo.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key as keyof TemplateVars];
    return v == null || v === "" ? match : String(v);
  });
}

export function abrirWhatsAppComTemplate(telefone: string, mensagem: string) {
  const tel = (telefone ?? "").replace(/\D/g, "");
  if (!tel) return false;
  const num = tel.length <= 11 ? "55" + tel : tel;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`, "_blank");
  return true;
}
