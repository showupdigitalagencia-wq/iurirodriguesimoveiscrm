import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Supabase Realtime changes on the given tables and invalidate
 * the specified TanStack Query keys on any event.
 */
export function useRealtimeInvalidate(
  tables: string[],
  queryKeys: readonly (readonly unknown[])[],
  channelName?: string,
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (tables.length === 0) return;
    const name = channelName ?? `rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel(name);
    for (const t of tables) {
      ch.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: t },
        () => {
          for (const key of queryKeys) qc.invalidateQueries({ queryKey: key as unknown[] });
        },
      );
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), channelName]);
}
