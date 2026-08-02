-- =============================================
-- MIA Conditional Knowledge Media — v016
-- Adds optional image + trigger condition to
-- knowledge_items, a dispatch-history table to
-- enforce "send each image once per conversation",
-- and a public-read Supabase Storage bucket for
-- commercial/testimonial images.
-- =============================================

-- -------------------------------------------------
-- 1. knowledge_items: conditional image columns
-- -------------------------------------------------
ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS trigger_condition TEXT;

COMMENT ON COLUMN public.knowledge_items.image_url IS
  'Public Supabase Storage URL of the image attached to this knowledge item.';
COMMENT ON COLUMN public.knowledge_items.trigger_condition IS
  'Descriptive label of when to send the image (e.g. "precio", "aspecto fisico", "testimonio/resultados").';

-- -------------------------------------------------
-- 2. chat_media_dispatched — one-time dispatch history
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_media_dispatched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_media_once UNIQUE (knowledge_item_id, conversation_id)
);

COMMENT ON TABLE public.chat_media_dispatched IS
  'Records which conditional images were already sent per conversation, so a knowledge item image is dispatched at most once per chat.';

CREATE INDEX IF NOT EXISTS idx_chat_media_business ON public.chat_media_dispatched(business_id);
CREATE INDEX IF NOT EXISTS idx_chat_media_conversation ON public.chat_media_dispatched(conversation_id);

-- RLS: only the owning business can read/write dispatch history
ALTER TABLE public.chat_media_dispatched ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_media_dispatched FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_media_dispatched"
  ON public.chat_media_dispatched FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_media_dispatched"
  ON public.chat_media_dispatched FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_media_dispatched"
  ON public.chat_media_dispatched FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- -------------------------------------------------
-- 3. Supabase Storage bucket (public read)
-- -------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-media',
  'knowledge-media',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (needed so WhatsApp clients can fetch the image URL)
CREATE POLICY "knowledge_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'knowledge-media');

-- Insert/update only by the owning business (path convention: <business_id>/<file>)
CREATE POLICY "knowledge_media_owner_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-media'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "knowledge_media_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'knowledge-media'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
