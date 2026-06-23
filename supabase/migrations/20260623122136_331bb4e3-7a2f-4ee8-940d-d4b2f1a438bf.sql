
-- Feed interno: posts, curtidas e comentários
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text,
  image_path text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_ref uuid,
  hidden_at timestamptz,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_posts_created_at_idx ON public.feed_posts (created_at DESC);
CREATE INDEX feed_posts_author_idx ON public.feed_posts (author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_posts_select" ON public.feed_posts FOR SELECT TO authenticated
  USING (hidden_at IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) OR author_id = auth.uid());

CREATE POLICY "feed_posts_insert" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "feed_posts_update" ON public.feed_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "feed_posts_delete" ON public.feed_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger de auditoria ao ocultar
CREATE OR REPLACE FUNCTION public.feed_posts_audit_hide()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.hidden_at IS NULL AND NEW.hidden_at IS NOT NULL) THEN
    PERFORM public.log_audit(
      'feed_post_hidden',
      'feed_posts',
      NEW.id::text,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object('author_id', NEW.author_id, 'hidden_by', NEW.hidden_by)
    );
  ELSIF (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL) THEN
    PERFORM public.log_audit(
      'feed_post_unhidden',
      'feed_posts',
      NEW.id::text,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feed_posts_audit_hide
  AFTER UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.feed_posts_audit_hide();

-- Auditoria em delete
CREATE TRIGGER trg_feed_posts_audit_delete
  AFTER DELETE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger();

-- Curtidas
CREATE TABLE public.feed_likes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX feed_likes_post_idx ON public.feed_likes (post_id);

GRANT SELECT, INSERT, DELETE ON public.feed_likes TO authenticated;
GRANT ALL ON public.feed_likes TO service_role;

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_likes_select" ON public.feed_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_likes_insert" ON public.feed_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "feed_likes_delete" ON public.feed_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Comentários
CREATE TABLE public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_comments_post_idx ON public.feed_comments (post_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.feed_comments TO authenticated;
GRANT ALL ON public.feed_comments TO service_role;

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_comments_select" ON public.feed_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_comments_insert" ON public.feed_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "feed_comments_delete" ON public.feed_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage policies para o bucket "feed" (bucket criado via tool)
CREATE POLICY "feed_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed');

CREATE POLICY "feed_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "feed_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role)));
