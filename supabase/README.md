# Supabase del piloto Los Sauces

## Aplicar el esquema

1. Creá un proyecto Supabase bajo tu cuenta.
2. En **SQL Editor**, ejecutá completo `migrations/20261027000100_init.sql`.
3. Configurá Google en **Authentication → Providers → Google**. Usá el callback que muestra Supabase en la pantalla del proveedor; no compartas el secreto OAuth en el chat ni lo pongas en archivos del sitio.
4. En **Authentication → URL Configuration**, agregá como URL de redirección la URL local de prueba y la URL final de Netlify.
5. Configurá `web/config.js` con el Project URL y la clave pública/publishable (nunca la clave `service_role`).
6. Iniciá sesión con la cuenta Google elegida como administradora. En **Table Editor → auth.users**, copiá su UUID y registralo desde SQL Editor:

   ```sql
   insert into public.app_admins (user_id)
   values ('<UUID_DE_TU_USUARIO_GOOGLE>');
   ```

7. Generá el código de invitación fuera de este repositorio y guardá solo su hash en Supabase. Por ejemplo, desde SQL Editor, reemplazando el marcador localmente:

   ```sql
   insert into public.invite_codes (code_hash, max_uses, expires_at)
   values (
     extensions.crypt('<CODIGO_PRIVADO>', extensions.gen_salt('bf')),
     50,
     now() + interval '90 days'
   );
   ```

   El código en texto claro no se guarda en la base ni en el sitio. No lo envíes por este chat.
8. Cuando el esquema, la cuenta admin y los permisos estén listos, importá el archivo histórico desde tu propia PC. Para `SUPABASE_SERVICE_ROLE_KEY`, usá la **Secret key** nueva `sb_secret_...` (recomendada) o la clave legacy `service_role`. Definí las variables solo en la terminal privada; no las escribas en un archivo del sitio ni las compartas:

   ```powershell
   $env:SUPABASE_URL = 'https://<TU_PROYECTO>.supabase.co'
   $env:SUPABASE_SERVICE_ROLE_KEY = '<CLAVE_PRIVADA_SERVICE_ROLE>'
   $env:OFIDI_ADMIN_USER_ID = '<UUID_DE_TU_USUARIO_GOOGLE>'
   node scripts/import-candidates.mjs --dry-run
   node scripts/import-candidates.mjs
   Remove-Item Env:SUPABASE_URL, Env:SUPABASE_SERVICE_ROLE_KEY, Env:OFIDI_ADMIN_USER_ID
   ```

   El `--dry-run` valida los 41 registros localmente sin enviar datos. La importación es re-ejecutable: los registros históricos no se duplican si se vuelve a correr. El script no imprime teléfonos ni la clave. La ficha queda como no verificada; el registro histórico se muestra como tal y no como un trabajo confirmado.

## Migraciones posteriores del piloto

Aplicá estas migraciones **en este orden**, una por vez, desde **SQL Editor → New query → Run**:

1. `migrations/20261027000200_provider_reviews.sql`: habilita **Dejar una opinión** directamente dentro de una ficha existente. Admite puntaje sin comentario o comentario sin puntaje, pero rechaza una opinión vacía; no vuelve a importar contactos.
2. `migrations/20261027000300_categories_and_restore.sql`: limita las nuevas altas a las 10 categorías del piloto y conserva la publicación inmediata para vecinos autorizados. Las bajas continúan como `disabled`, lo que permite restaurarlas desde la papelera administrativa.
3. `migrations/20261027000400_suggested_categories_and_admin_inbox.sql`: agrega **+ Otro rubro...**. La ficha se publica de inmediato como rubro sugerido, mientras el administrador puede aprobar el nuevo rubro para incorporarlo a las categorías oficiales. También separa en la interfaz los reportes pendientes del historial.

## Seguridad prevista

- Los perfiles y las reseñas son legibles públicamente; los teléfonos viven en una tabla aparte protegida por RLS.
- Google identifica la cuenta; solo el canje del código crea membresía del barrio.
- Altas, reportes, contactos y código de invitación se procesan con funciones PostgreSQL que validan la autorización.
- La identidad real del contribuyente se almacena separada de la recomendación pública. Su nombre solo se muestra por opt-in.
- Los tickets no desactivan fichas. Solo el rol administrador puede corregir o desactivar.
- La clave `service_role` nunca se utiliza desde el navegador.

**Estado del piloto:** la migración inicial fue aplicada, Google OAuth está configurado y se importaron los 41 candidatos. Las migraciones incrementales 002 (opiniones directas), 003 (categorías y papelera) y 004 (rubros sugeridos y bandeja de reportes) todavía deben aplicarse antes de desplegar esta nueva versión de `web/`. Están cubiertas por pruebas estáticas; todavía deben verificarse contra el proyecto Supabase real.
