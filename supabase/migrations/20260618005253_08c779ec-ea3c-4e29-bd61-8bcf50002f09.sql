ALTER PUBLICATION supabase_realtime ADD TABLE public.reuniao_participantes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reunioes;
ALTER TABLE public.reuniao_participantes REPLICA IDENTITY FULL;
ALTER TABLE public.reunioes REPLICA IDENTITY FULL;