-- =============================================
-- MIA - Asistente de Ventas IA
-- Initial Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- BUSINESS
-- =============================================
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  onboarding_status TEXT NOT NULL DEFAULT 'created' CHECK (onboarding_status IN ('created', 'identity_completed', 'business_completed', 'products_completed', 'rules_completed', 'ready')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);

-- =============================================
-- BRAND IDENTITY
-- =============================================
CREATE TABLE public.brand_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  tagline TEXT,
  target_customers TEXT,
  differentiators TEXT,
  elevator_pitch TEXT,
  tone_of_voice TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PRODUCTS (structured data)
-- =============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2),
  description TEXT,
  benefits TEXT,
  faq JSONB DEFAULT '[]'::jsonb,
  restrictions TEXT,
  image_url TEXT,
  documents TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_business ON public.products(business_id);

-- =============================================
-- KNOWLEDGE BASE (free-form information)
-- =============================================
CREATE TABLE public.knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('business_info', 'faq', 'objection', 'process', 'tip')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('onboarding', 'manual', 'correction', 'document', 'audio')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_business ON public.knowledge_items(business_id);

-- =============================================
-- SALES RULES
-- =============================================
CREATE TABLE public.sales_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('zones', 'payment', 'schedule', 'promotions', 'restrictions', 'escalation')),
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rules_business ON public.sales_rules(business_id);

-- =============================================
-- AI INSTRUCTIONS (behavior)
-- =============================================
CREATE TABLE public.ai_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  instruction TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'onboarding', 'correction')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instructions_business ON public.ai_instructions(business_id);

-- =============================================
-- ASSISTANTS
-- =============================================
CREATE TABLE public.assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'MIA',
  personality JSONB NOT NULL DEFAULT '{"warmth":70,"formality":40,"humor":30,"sales_aggressiveness":50}'::jsonb,
  communication_style TEXT NOT NULL CHECK (communication_style IN ('formal', 'casual', 'warm', 'direct')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistants_business ON public.assistants(business_id);

-- =============================================
-- ASSISTANT CHANNELS
-- =============================================
CREATE TABLE public.assistant_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'messenger', 'instagram')),
  credentials JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channels_assistant ON public.assistant_channels(assistant_id);

-- =============================================
-- CUSTOMERS (commercial memory)
-- =============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'converted', 'lost')),
  notes TEXT,
  last_interaction TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_business ON public.customers(business_id);

-- =============================================
-- ASSISTANT MEMORY (conversation memory)
-- =============================================
CREATE TABLE public.assistant_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'previous_question', 'purchase_history', 'important_note')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memories_assistant ON public.assistant_memories(assistant_id);
CREATE INDEX idx_memories_customer ON public.assistant_memories(customer_id);

-- =============================================
-- CONVERSATIONS
-- =============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('training', 'live', 'simulation')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  assigned_to UUID,
  handover_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_assistant ON public.conversations(assistant_id);

-- =============================================
-- MESSAGES
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'correction', 'system', 'simulated_customer')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);

-- =============================================
-- LEARNING EVENTS
-- =============================================
CREATE TABLE public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  original_response TEXT NOT NULL,
  corrected_response TEXT,
  knowledge_item_id UUID REFERENCES public.knowledge_items(id) ON DELETE SET NULL,
  knowledge_change JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  authorized_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_events_assistant ON public.learning_events(assistant_id);
CREATE INDEX idx_learning_events_status ON public.learning_events(status);

-- =============================================
-- KNOWLEDGE VERSIONS (audit trail)
-- =============================================
CREATE TABLE public.knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('knowledge_item', 'sales_rule', 'ai_instruction', 'product')),
  entity_id UUID NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_source TEXT NOT NULL CHECK (change_source IN ('onboarding', 'correction', 'manual', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_versions_business ON public.knowledge_versions(business_id);
CREATE INDEX idx_versions_entity ON public.knowledge_versions(entity_type, entity_id);

-- =============================================
-- AI USAGE (cost tracking)
-- =============================================
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.assistants(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_business ON public.ai_usage(business_id);
CREATE INDEX idx_usage_date ON public.ai_usage(created_at);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Helper function for business access
CREATE OR REPLACE FUNCTION public.get_user_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.businesses WHERE owner_id = (SELECT auth.uid())
$$;

-- Enable RLS on all tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.brand_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_instructions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assistants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_channels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_memories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage FORCE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Businesses
CREATE POLICY "users_can_view_own_businesses"
  ON public.businesses FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_businesses"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "users_can_update_own_businesses"
  ON public.businesses FOR UPDATE TO authenticated
  USING (id IN (SELECT public.get_user_business_ids()));

-- Brand Identities
CREATE POLICY "users_can_view_own_brand"
  ON public.brand_identities FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_brand"
  ON public.brand_identities FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_brand"
  ON public.brand_identities FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Products
CREATE POLICY "users_can_view_own_products"
  ON public.products FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_products"
  ON public.products FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_products"
  ON public.products FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Knowledge Items
CREATE POLICY "users_can_view_own_knowledge"
  ON public.knowledge_items FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_knowledge"
  ON public.knowledge_items FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_knowledge"
  ON public.knowledge_items FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_knowledge"
  ON public.knowledge_items FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Sales Rules
CREATE POLICY "users_can_view_own_rules"
  ON public.sales_rules FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_rules"
  ON public.sales_rules FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_rules"
  ON public.sales_rules FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_rules"
  ON public.sales_rules FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- AI Instructions
CREATE POLICY "users_can_view_own_instructions"
  ON public.ai_instructions FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_instructions"
  ON public.ai_instructions FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_instructions"
  ON public.ai_instructions FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_delete_own_instructions"
  ON public.ai_instructions FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Assistants
CREATE POLICY "users_can_view_own_assistants"
  ON public.assistants FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_assistants"
  ON public.assistants FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_assistants"
  ON public.assistants FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Assistant Channels
CREATE POLICY "users_can_view_own_channels"
  ON public.assistant_channels FOR SELECT TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_insert_channels"
  ON public.assistant_channels FOR INSERT TO authenticated
  WITH CHECK (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_update_own_channels"
  ON public.assistant_channels FOR UPDATE TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

-- Customers
CREATE POLICY "users_can_view_own_customers"
  ON public.customers FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_update_own_customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

-- Assistant Memories
CREATE POLICY "users_can_view_own_memories"
  ON public.assistant_memories FOR SELECT TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_insert_memories"
  ON public.assistant_memories FOR INSERT TO authenticated
  WITH CHECK (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

-- Conversations
CREATE POLICY "users_can_view_own_conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_insert_conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

-- Messages
CREATE POLICY "users_can_view_own_messages"
  ON public.messages FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE assistant_id IN (
      SELECT id FROM public.assistants 
      WHERE business_id IN (SELECT public.get_user_business_ids())
    )
  ));

CREATE POLICY "users_can_insert_messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE assistant_id IN (
      SELECT id FROM public.assistants 
      WHERE business_id IN (SELECT public.get_user_business_ids())
    )
  ));

-- Learning Events
CREATE POLICY "users_can_view_own_learning_events"
  ON public.learning_events FOR SELECT TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_insert_learning_events"
  ON public.learning_events FOR INSERT TO authenticated
  WITH CHECK (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

CREATE POLICY "users_can_update_own_learning_events"
  ON public.learning_events FOR UPDATE TO authenticated
  USING (assistant_id IN (
    SELECT id FROM public.assistants 
    WHERE business_id IN (SELECT public.get_user_business_ids())
  ));

-- Knowledge Versions
CREATE POLICY "users_can_view_own_versions"
  ON public.knowledge_versions FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_versions"
  ON public.knowledge_versions FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- AI Usage
CREATE POLICY "users_can_view_own_usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_usage"
  ON public.ai_usage FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));
