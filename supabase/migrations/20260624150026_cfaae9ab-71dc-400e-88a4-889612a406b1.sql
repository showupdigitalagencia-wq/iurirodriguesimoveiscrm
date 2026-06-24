CREATE OR REPLACE FUNCTION public.normalize_feed_post_media_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized text;
  path_lower text;
BEGIN
  normalized := lower(trim(coalesce(NEW.media_type, '')));
  path_lower := lower(coalesce(NEW.image_path, ''));

  normalized := CASE normalized
    WHEN 'imagem' THEN 'image'
    WHEN 'foto' THEN 'image'
    WHEN 'photo' THEN 'image'
    WHEN 'video' THEN 'video'
    WHEN 'vídeo' THEN 'video'
    WHEN 'audio' THEN 'audio'
    WHEN 'áudio' THEN 'audio'
    WHEN 'texto' THEN 'text'
    WHEN 'post_text' THEN 'text'
    ELSE normalized
  END;

  IF normalized = '' THEN
    IF NEW.image_path IS NULL AND nullif(trim(coalesce(NEW.caption, '')), '') IS NOT NULL THEN
      normalized := 'text';
    ELSIF path_lower ~ '\.(webm|m4a|mp3|ogg|wav|aac)(\?.*)?$' THEN
      normalized := 'audio';
    ELSIF path_lower ~ '\.(mp4|mov|m4v|webm)(\?.*)?$' THEN
      normalized := 'video';
    ELSE
      normalized := 'image';
    END IF;
  END IF;

  NEW.media_type := normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_feed_post_media_type_before_write ON public.feed_posts;
CREATE TRIGGER normalize_feed_post_media_type_before_write
BEFORE INSERT OR UPDATE OF media_type, image_path, caption ON public.feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_feed_post_media_type();

ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_media_type_check;
ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_media_type_check
  CHECK (media_type = ANY (ARRAY['image'::text, 'video'::text, 'text'::text, 'audio'::text]));