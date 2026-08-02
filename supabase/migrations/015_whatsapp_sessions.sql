-- =============================================
-- MIA WhatsApp Bridge — Baileys Session Persistence
-- Stores Baileys AuthenticationState (creds + signal keys)
-- per business. The WhatsApp Bridge (services/whatsapp-bridge)
-- reads/writes this exclusively via the service role key.
-- =============================================

CREATE TABLE public.whatsapp_sessions (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  creds JSONB DEFAULT '{}'::jsonb,
  keys JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  phone TEXT,
  pairing_code TEXT,
  error_message TEXT,
  last_qr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SECURITY: this table holds WhatsApp session credentials
-- (signal encryption keys). It MUST NOT be reachable through
-- the public Data API. Only the bridge service (service role
-- key, bypasses RLS) touches it. No user policies are created,
-- and anon/authenticated are denied entirely.
-- =============================================
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_sessions FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_sessions FROM PUBLIC;

-- Index for status lookups by the bridge
CREATE INDEX idx_whatsapp_sessions_status ON public.whatsapp_sessions(status);
