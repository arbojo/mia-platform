-- =============================================
-- MIA Communication Layer
-- Channel Connections Schema
-- =============================================

-- =============================================
-- CHANNEL CONNECTIONS
-- Stores authentication/credentials per channel
-- =============================================
CREATE TABLE public.channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'messenger', 'instagram')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  credentials JSONB DEFAULT '{}'::jsonb,
  configuration JSONB DEFAULT '{}'::jsonb,
  last_sync TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_connections_business ON public.channel_connections(business_id);
CREATE INDEX idx_channel_connections_assistant ON public.channel_connections(assistant_id);

-- =============================================
-- CHANNEL MESSAGES
-- Normalized messages from all channels
-- =============================================
CREATE TABLE public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'document')),
  external_id TEXT,
  external_customer_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_messages_business ON public.channel_messages(business_id);
CREATE INDEX idx_channel_messages_customer ON public.channel_messages(customer_id);
CREATE INDEX idx_channel_messages_channel ON public.channel_messages(channel);
CREATE INDEX idx_channel_messages_external ON public.channel_messages(external_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Channel Connections
CREATE POLICY "users_can_view_own_channel_connections"
  ON public.channel_connections FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_channel_connections"
  ON public.channel_connections FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_channel_connections"
  ON public.channel_connections FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_channel_connections"
  ON public.channel_connections FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Channel Messages
CREATE POLICY "users_can_view_own_channel_messages"
  ON public.channel_messages FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_channel_messages"
  ON public.channel_messages FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_channel_messages"
  ON public.channel_messages FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Enable RLS
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

-- Force RLS
ALTER TABLE public.channel_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages FORCE ROW LEVEL SECURITY;
