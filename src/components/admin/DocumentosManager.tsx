import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteDocumento,
  listDocumentos,
  uploadDocumento,
} from "@/lib/drive.functions";

type DocTipo =
  | "contrato"
  | "rg"
  | "cpf"
  | "comprovante_renda"
  | "fiador"
  | "foto_imovel"
  | "outro";

const TIPO_LABEL: Record<DocTipo, string> = {
  contrato: "Contrato assinado",
  rg: "RG do locatário",
  cpf: "CPF do locatário",
  comprovante_renda: "Comprovante de renda",
  fiador: "Documentos do fiador",
  foto_imovel: "Foto do imóvel",
  outro: "Outro",
};

type Documento = {
  id: string;
  tipo: DocTipo;
  nome: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  drive_web_view_link: string | null;
  created_at: string;
};

function formatSize(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  imovelId?: string;
  contratoId?: string;
}

export function DocumentosManager({ imovelId, contratoId }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocumentos);
  const uploadFn = useServerFn(uploadDocumento);
  const deleteFn = useServerFn(deleteDocumento);

  const queryKey = ["documentos", { imovelId, contratoId }];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { imovelId, contratoId } }),
  });
  const documentos = (data?.documentos ?? []) as unknown as Documento[];

  const [tipo, setTipo] = useState<DocTipo>("contrato");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      return uploadFn({
        data: {
          imovelId,
          contratoId,
          tipo,
          nome: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento enviado para o Google Drive");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => {
      const msg = e.message ?? "Falha no upload";
      if (msg.includes("Google não conectado")) {
        toast.error("Conecte sua conta Google em Configurações para enviar documentos");
      } else {
        toast.error(msg);
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePick = () => inputRef.current?.click();
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload.mutate(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo do documento</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as DocTipo)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABEL) as DocTipo[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handlePick} disabled={upload.isPending}>
          {upload.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Enviar documento
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFile}
          accept="image/*,application/pdf,.doc,.docx"
        />
      </div>

      <div className="border rounded-md divide-y">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos...
          </div>
        ) : documentos.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhum documento enviado ainda.
          </div>
        ) : (
          documentos.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {TIPO_LABEL[d.tipo] ?? d.tipo} · {formatSize(d.tamanho_bytes)} ·{" "}
                  {new Date(d.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
              {d.drive_web_view_link && (
                <Button asChild variant="ghost" size="sm">
                  <a href={d.drive_web_view_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Remover "${d.nome}"?`)) remove.mutate(d.id);
                }}
                disabled={remove.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Os arquivos são salvos no Google Drive da sua conta, organizados em{" "}
        <code>Imóveis CRM / [endereço]</code>
        {contratoId ? <> <code>/ Contratos / [locatário]</code></> : null}.
      </p>
    </div>
  );
}
