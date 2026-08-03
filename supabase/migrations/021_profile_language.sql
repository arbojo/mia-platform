-- =============================================
-- 021: Idioma de la interfaz (i18n)
--
-- Persiste el idioma activo de la interfaz por usuario en profiles.
-- El trigger de auto-provisi�n inserta el perfil con DEFAULT, as� que
-- cualquier usuario existente recibe 'es' y el c�digo aplica defaults.
-- La RLS existente (profiles_select_own / profiles_update_own) ya cubre
-- esta columna: el usuario solo ve y modifica su propio idioma.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es'
  CHECK (language IN ('es', 'en', 'pt', 'ja'));
