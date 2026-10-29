# Web piloto OFIDI · Los Sauces

Sitio estático mobile-first en `web/`, conectado a Supabase desde el navegador mediante `@supabase/supabase-js` (ESM CDN). No necesita un proceso de build para Netlify.

## Desarrollo local

Abrí la carpeta `web/` con un servidor estático local (no uses `file://` porque OAuth y módulos ESM requieren un origen HTTP). Antes de conectar Supabase, completá `config.js` con:

- `supabaseUrl`: URL del proyecto Supabase.
- `supabasePublishableKey`: clave pública/publishable del proyecto. No es la `service_role`.

El archivo incluye valores de ejemplo. No pegues credenciales de administración ni claves `service_role` en el frontend.

## Funciones implementadas

- Búsqueda pública por nombre, alias y rubro; sin guardar el texto buscado.
- Las fichas y opiniones se muestran como aportes comunitarios no verificados por OFIDI.
- Teléfonos disponibles solo con sesión Google y membresía Los Sauces validada mediante código de invitación.
- Altas con consentimiento para compartir, recomendación, estrellas opcionales y atribución privada por defecto.
- Opiniones directas desde la ficha existente, sin volver a ingresar el teléfono; puntaje, comentario o ambos, con atribución privada por defecto.
- Chips de filtro, selector cerrado con las 10 categorías del piloto y opción **+ Otro rubro...**; el rubro sugerido se publica con la ficha y requiere aprobación administrativa para incorporarse a la lista oficial.
- Promedio y cantidad de estrellas directamente en cada tarjeta; “Sin opiniones aún” cuando no existen puntajes.
- Papelera administrativa: una ficha desactivada se oculta del barrio y puede restaurarse sin cargarla otra vez.
- Panel de reportes separado entre pendientes e historial, para que los resueltos/descartados salgan de la bandeja activa.
- Dedupe transaccional en Supabase por celular normalizado; la recomendación se suma a la ficha existente.
- Reportes que crean tickets; no ocultan fichas automáticamente.
- Vista administrativa para revisar tickets y desactivar fichas manualmente.
- Métrica anónima de búsquedas (solo cantidad de resultados) y clics de contacto; no mide conversaciones ni trabajos.

## Pendiente

- Aplicar, en orden, `supabase/migrations/20261027000200_provider_reviews.sql`, `supabase/migrations/20261027000300_categories_and_restore.sql` y `supabase/migrations/20261027000400_suggested_categories_and_admin_inbox.sql` antes de desplegar esta versión.
- Volver a desplegar la carpeta `web/` en Netlify tras cada cambio de la interfaz.
- Probar el flujo de opinión directa, restauración y alta con categoría cerrada usando una cuenta vecinal autorizada; una opinión pública requiere una experiencia real y consentimiento de atribución opt-in.
