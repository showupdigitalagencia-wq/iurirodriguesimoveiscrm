
-- ============= feed_stories =============
CREATE TABLE public.feed_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  hidden_at timestamptz,
  hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX feed_stories_active_idx ON public.feed_stories (expires_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX feed_stories_author_idx ON public.feed_stories (author_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_stories TO authenticated;
GRANT ALL ON public.feed_stories TO service_role;

ALTER TABLE public.feed_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_active_or_admin"
  ON public.feed_stories FOR SELECT TO authenticated
  USING (
    (hidden_at IS NULL AND expires_at > now())
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "stories_insert_self"
  ON public.feed_stories FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "stories_update_owner_or_admin"
  ON public.feed_stories FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "stories_delete_owner_or_admin"
  ON public.feed_stories FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============= feed_story_views =============
CREATE TABLE public.feed_story_views (
  story_id uuid NOT NULL REFERENCES public.feed_stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX feed_story_views_viewer_idx ON public.feed_story_views (viewer_id);

GRANT SELECT, INSERT ON public.feed_story_views TO authenticated;
GRANT ALL ON public.feed_story_views TO service_role;

ALTER TABLE public.feed_story_views ENABLE ROW LEVEL SECURITY;

-- Viewer pode ler o próprio registro (pra saber o que já viu);
-- autor do story e admin podem ler tudo daquele story.
CREATE POLICY "story_views_select_self_or_owner_or_admin"
  ON public.feed_story_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.feed_stories s
      WHERE s.id = feed_story_views.story_id AND s.author_id = auth.uid()
    )
  );

CREATE POLICY "story_views_insert_self"
  ON public.feed_story_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- ============= Realtime =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_story_views;
