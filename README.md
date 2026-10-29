# OFIDI · Oficios de Los Sauces

Piloto comunitario para encontrar profesionales y servicios del barrio sin buscar referencias en el historial de WhatsApp.

## Estructura

- `prototype/`: prototipo clickeable de descubrimiento; sigue siendo una demo independiente.
- `web/`: interfaz estática responsive conectada al SDK de Supabase desde navegador.
- `supabase/migrations/`: esquema PostgreSQL, funciones y políticas RLS.
- `scripts/import-candidates.mjs`: importación privada, validada e idempotente del registro histórico.
- `materiales/candidatos-profesionales-interno.csv`: fuente interna con datos personales; no copiarla al directorio público.

## Verificación local

```powershell
node --test web/test/*.test.mjs
node --check web/src/main.mjs
node --check scripts/import-candidates.mjs
node scripts/import-candidates.mjs --dry-run
```

El dry-run solo valida el CSV local; no contacta Supabase.

## Estado

Supabase, Google OAuth y Netlify ya están configurados; la migración inicial se aplicó y los 41 contactos fueron importados. Antes de desplegar la siguiente versión: aplicar en orden `supabase/migrations/20261027000200_provider_reviews.sql`, `supabase/migrations/20261027000300_categories_and_restore.sql` y `supabase/migrations/20261027000400_suggested_categories_and_admin_inbox.sql`, y volver a publicar `web/` en Netlify. La versión agrega opiniones directas, reputación en tarjetas, rubros sugeridos, papelera restaurable y bandeja de reportes separada. Ver `supabase/README.md` y `web/README.md`. Nunca compartas claves secretas ni códigos de invitación por el chat.
