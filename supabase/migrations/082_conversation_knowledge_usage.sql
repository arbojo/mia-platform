-- =============================================
-- MIA Learning Loop - v082
-- Conversational knowledge sales impact
--
-- Cierra el bucle "aprender de conversaciones reales -> usar -> VENDER":
-- registra QUÉ knowledge_items se inyectaron en QUÉ conversación real
-- para poder responder byte-fiel: "¿ESTE conocimiento sirvió para cerrar?"
-- =============================================

-- 1. Junction: conversation <-> knowledge_items usados
CREATE TABLE IF NOT EXISTS public.conversation_knowledge_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotente: un knowledge no se cuenta 2x en la misma conversación
  CONSTRAINT conversation_knowledge_usage_unique
    UNIQUE (conversation_id, knowledge_item_id)
);

-- 2. RLS: solo el dueño del negocio (mismo patrón que las 11 tablas existentes)
ALTER TABLE public.conversation_knowledge_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_knowledge_usage FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_conversation_knowledge_usage"
  ON public.conversation_knowledge_usage FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.get_user_business_ids()));

CREATE POLICY "users_can_insert_own_conversation_knowledge_usage"
  ON public.conversation_knowledge_usage FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT public.get_user_business_ids()));

-- 3. Índices para el cruce venta<->knowledge eficiente
CREATE INDEX IF NOT EXISTS idx_cku_conversation
  ON public.conversation_knowledge_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cku_knowledge
  ON public.conversation_knowledge_usage(knowledge_item_id);
CREATE INDEX IF NOT EXISTS idx_cku_business_created
  ON public.conversation_knowledge_usage(business_id, created_at DESC);

-- 4. Función de impacto: por knowledge_item -> conversaciones usadas, vendidas, % cierre
CREATE OR REPLACE FUNCTION public.get_knowledge_sales_impact(p_business_id UUID)
RETURNS TABLE (
  knowledge_item_id UUID,
  question TEXT,
  category TEXT,
  conversations_used BIGINT,
  conversations_sold BIGINT,
  close_rate NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    ki.id,
    ki.question,
    ki.category,
    COUNT(cku.id)::BIGINT AS conversations_used,
    COUNT(cv.id) FILTER (WHERE cv.outcome = 'sold')::BIGINT AS conversations_sold,
    CASE
      WHEN COUNT(cku.id) = 0 THEN 0
      ELSE ROUND((COUNT(cv.id) FILTER (WHERE cv.outcome = 'sold'))::NUMERIC / COUNT(cku.id), 4)
    END AS close_rate
  FROM public.knowledge_items ki
  LEFT JOIN public.conversation_knowledge_usage cku ON cku.knowledge_item_id = ki.id
  LEFT JOIN public.conversations cv ON cv.id = cku.conversation_id
  WHERE ki.business_id = p_business_id
  GROUP BY ki.id, ki.question, ki.category
  ORDER BY conversations_used DESC;
END;
$$;
