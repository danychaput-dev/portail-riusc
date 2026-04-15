-- Ajoute methode_connexion au retour du RPC check_reserviste_login
-- Utilisé par /login pour décider entre SMS ou courriel pour l'OTP.

DROP FUNCTION IF EXISTS public.check_reserviste_login(text);

CREATE OR REPLACE FUNCTION public.check_reserviste_login(lookup_email text)
 RETURNS TABLE(benevole_id text, prenom text, nom text, email text, telephone text, groupe text, methode_connexion text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT benevole_id, prenom, nom, email, telephone, groupe, methode_connexion
  FROM reservistes
  WHERE LOWER(email) = LOWER(lookup_email)
    AND deleted_at IS NULL
  LIMIT 1;
$function$;
