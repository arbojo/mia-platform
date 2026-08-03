-- =============================================
-- 020: Preferencias de accesibilidad y ergonomía
--
-- Persiste las preferencias de accesibilidad del usuario en la tabla
-- de perfil: modo espejo (sidebar derecha/izquierda), modo óptico
-- antifatiga, peso de fuente y temperatura de color.
-- El trigger de auto-provisión inserta el perfil con DEFAULT, así que
-- cualquier usuario existente recibe '{}' y el código aplica defaults.
-- La RLS existente (profiles_select_own / profiles_update_own) ya cubre
-- esta columna: el usuario solo ve y modifica su propio perfil.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
