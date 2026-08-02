-- 017: Perfiles de usuario (leads demo/trial) + soporte de request_type 'demo' en ai_usage
--
-- Objetivo: captura de leads con auto-registro híbrido (email + Google).
-- - public.profiles: rol/estado por defecto (demo/trial) para cada usuario nuevo.
-- - Trigger on_auth_user_created: crea el perfil automáticamente en cada signup.
-- - Amplía el CHECK de ai_usage.request_type para incluir 'demo' (la demo pública
--   ya insertaba 'demo' pero el constraint lo rechazaba → bug 23514 latente).

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'demo' CHECK (role IN ('demo', 'user', 'admin')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'disabled')),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  demo_interactions_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Incremento atómico del contador de interacciones de la demo.
-- Devuelve el nuevo valor (evita lectura + escritura con condiciones de carrera).
CREATE OR REPLACE FUNCTION public.increment_demo_interactions(target_user uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET demo_interactions_used = demo_interactions_used + 1,
      updated_at = now()
  WHERE id = target_user
  RETURNING demo_interactions_used;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Amplía el CHECK de ai_usage.request_type para incluir 'demo'.
-- Usa un DO block para ubicar el constraint por nombre generado automáticamente.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.ai_usage'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%request_type%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ai_usage DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.ai_usage
  ADD CONSTRAINT ai_usage_request_type_check
  CHECK (request_type IN ('training', 'simulation', 'live_customer', 'demo'));
