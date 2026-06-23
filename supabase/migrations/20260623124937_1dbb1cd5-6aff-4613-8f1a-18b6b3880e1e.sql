ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video'));
ALTER TABLE public.feed_stories ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video'));
ALTER TABLE public.feed_stories ADD COLUMN IF NOT EXISTS duration_ms integer;