-- =============================================
-- 022: Channel operation modes (active/shadow/paused)
--
-- Añade el estado de operación por conexión. El modo controla cómo el
-- runtime procesa los mensajes entrantes del canal:
--
--   - 'active'  : comportamiento normal. Responde al cliente.
--   - 'shadow'  : procesa, analiza y registra internamente la conversación
--                 (aprendizaje) pero NO entrega la respuesta al cliente.
--   - 'paused'  : canal inactivo. Ni ejecuta AI ni responde.
--
-- El valor vive en channel_connections porque el modo es por canal.
-- =============================================

ALTER TABLE public.channel_connections
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'active'
    CHECK (mode IN ('active', 'shadow', 'paused'));
