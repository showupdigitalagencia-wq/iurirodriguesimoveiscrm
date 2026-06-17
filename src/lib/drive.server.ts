// Google Drive helpers — server only.
// Reuses the per-user Google OAuth tokens already used for Calendar/Meet.
// Scope required: https://www.googleapis.com/auth/drive.file
// (granted by re-connecting Google in Configurações after this update).

import { getValidAccessToken } from "@/lib/google.server";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive ${init?.method ?? "GET"} ${url} failed: ${res.status} ${body}`);
  }
  return res;
}

/** Find a child folder by name under parentId, or null. */
async function findChildFolder(
  token: string,
  parentId: string | "root",
  name: string,
): Promise<string | null> {
  const q = [
    `mimeType='${FOLDER_MIME}'`,
    `trashed=false`,
    `'${parentId}' in parents`,
    `name='${name.replace(/'/g, "\\'")}'`,
  ].join(" and ");
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await driveFetch(token, url);
  const j = (await res.json()) as { files?: { id: string; name: string }[] };
  return j.files?.[0]?.id ?? null;
}

async function createFolder(
  token: string,
  parentId: string | "root",
  name: string,
): Promise<string> {
  const res = await driveFetch(token, `${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
  const j = (await res.json()) as { id: string };
  return j.id;
}

async function ensureFolder(
  token: string,
  parentId: string | "root",
  name: string,
): Promise<string> {
  const existing = await findChildFolder(token, parentId, name);
  if (existing) return existing;
  return createFolder(token, parentId, name);
}

/** Build (or reuse) the folder path: Imóveis CRM / <endereco> / [Contratos / <locatario>] */
export async function ensureImovelFolder(
  userId: string,
  enderecoImovel: string,
): Promise<{ folderId: string; accessToken: string }> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("Google não conectado para este usuário");
  const root = await ensureFolder(token, "root", "Imóveis CRM");
  const imovelFolder = await ensureFolder(token, root, enderecoImovel || "Sem endereço");
  return { folderId: imovelFolder, accessToken: token };
}

export async function ensureContratoFolder(
  userId: string,
  enderecoImovel: string,
  locatarioNome: string,
): Promise<{ folderId: string; accessToken: string }> {
  const { folderId: imovelFolder, accessToken } = await ensureImovelFolder(userId, enderecoImovel);
  const contratosFolder = await ensureFolder(accessToken, imovelFolder, "Contratos");
  const contratoFolder = await ensureFolder(
    accessToken,
    contratosFolder,
    locatarioNome || "Sem locatário",
  );
  return { folderId: contratoFolder, accessToken };
}

export type DriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string | null;
  webContentLink: string | null;
};

/** Upload a single file (multipart) to the given Drive folder. */
export async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  file: { name: string; mimeType: string; bytes: Uint8Array },
): Promise<DriveUploadResult> {
  const boundary = `lvbl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: file.name,
    parents: [folderId],
    mimeType: file.mimeType || "application/octet-stream",
  };

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${metadata.mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(head.length + file.bytes.length + tail.length);
  body.set(head, 0);
  body.set(file.bytes, head.length);
  body.set(tail, head.length + file.bytes.length);

  const url = `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink`;
  const res = await driveFetch(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const j = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
    webContentLink?: string;
  };
  return {
    id: j.id,
    name: j.name,
    mimeType: j.mimeType,
    size: j.size ? Number(j.size) : null,
    webViewLink: j.webViewLink ?? null,
    webContentLink: j.webContentLink ?? null,
  };
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Drive DELETE failed: ${res.status} ${await res.text()}`);
  }
}
