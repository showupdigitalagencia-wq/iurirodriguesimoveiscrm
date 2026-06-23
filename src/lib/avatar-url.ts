import { supabase } from "@/integrations/supabase/client";

const BUCKET = "feed";
const cache = new Map<string, { url: string; exp: number }>();

/** Resolve a signed URL for an avatar path stored in profiles.avatar_url.
 *  Accepts null/empty and returns null. Caches for 50min. */
export async function signAvatar(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

/** Sign multiple avatar paths in parallel. Returns id -> url map. */
export async function signAvatarMap(
  entries: Array<{ id: string; path: string | null | undefined }>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    entries.map(async ({ id, path }) => {
      const u = await signAvatar(path);
      if (u) out[id] = u;
    }),
  );
  return out;
}

export function clearAvatarCache(path?: string) {
  if (path) cache.delete(path);
  else cache.clear();
}
