-- 018: Auto-provisión de negocio por defecto en el signup (OAuth/email)
--
-- Objetivo: corregir el flujo en el que un usuario nuevo autenticado quedaba
-- sin contexto (a /demo) porque no tenía business. Ahora el trigger
-- on_auth_user_created crea automáticamente un negocio por defecto para cada
-- usuario nuevo, salvo los leads de demo (raw_user_meta_data.signup_source = 'demo').
--
-- - El signup por email puede pasar signup_source (vía options.data).
-- - El signup por Google OAuth siempre recibe un negocio por defecto (el SDK
--   no permite metadata en OAuth; es además la mejor ruta de conversión).
-- - El negocio se crea con onboarding_status 'created': el onboarding
--   conversacional lo actualiza (no crea duplicados) y el banner del dashboard
--   guía al usuario a completarlo.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup_source text := coalesce(new.raw_user_meta_data->>'signup_source', '');
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;

  IF v_signup_source <> 'demo' AND NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE owner_id = new.id
  ) THEN
    INSERT INTO public.businesses (owner_id, name, onboarding_status)
    VALUES (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'business_name', ''), 'Mi negocio'),
      'created'
    );
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
