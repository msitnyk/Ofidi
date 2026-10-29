# Prototipo - Oficios de Los Sauces

**Concepto:** directorio comunitario móvil de oficios y servicios para Los Sauces.  
**Generado:** 2026-10-26  
**Abrir:** doble clic en `index.html`; no requiere servidor ni instalación.

## Fidelidad

- **Visual: baja** — es una hipótesis temprana y se deja fácil de cambiar.
- **Contenido: medio** — incluye tres perfiles aportados por el responsable del proyecto; falta confirmar cobertura y vigencia.
- **Interacción: media** — búsqueda, WhatsApp directo, simulación de Google login, alta, deduplicación por celular y reporte; no hay backend.

## Recorridos

| Ruta | Propósito |
|---|---|
| `#buscar` | Buscar por rubro, zona o alias sin iniciar sesión |
| `#resultados` | Comparar perfiles y abrir una ficha |
| `#perfil` | Ver servicios, datos de contacto, referencia y reseñas |
| `#sin-resultados` | Sugerir un profesional si no hay ficha cargada |
| `#acceso-google` | Simular el acceso requerido para aportar o reportar |
| `#sugerir` | Cargar nombre, celular, rubro, motivo y permiso para compartir el número |
| `#duplicado` | Evitar una segunda ficha y adjuntar una recomendación a la existente |
| `#error-sugerencia` | Corregir los campos obligatorios |
| `#sugerencia-enviada` | Confirmar la ficha nueva o recomendación agregada |
| `#reportar` | Reportar un dato o una experiencia |
| `#reporte-enviado` | Confirmar que el reporte se enviaría al administrador |

## Reglas del piloto reflejadas

- Buscar es abierto; aportar o reportar requiere Google login. **En esta demo el login es simulado**, no OAuth real.
- El contribuyente confirma que puede compartir el teléfono. La identidad que aporta Google queda privada; mostrar su nombre es opcional.
- El teléfono se normaliza para detectar duplicados. Si ya existe, se suma una recomendación a la ficha canónica; si no existe, se publica de inmediato como **aporte vecinal, no verificado por OFIDI**. No se requiere cuenta ni aprobación del profesional.
- Los alias se buscan en una ficha canónica. En el caso de Teófilo/Modesto, dos tarjetas VCF comparten celular; las coincidencias con nombre parecido pero número distinto se revisan manualmente.
- Las fichas muestran fuente y motivo de la recomendación. Una recomendación no equivale a una reseña ni a una verificación profesional.
- Las reseñas son opcionales y comunitarias. OFIDI no sabe si se completó el trabajo; no se deben presentar como transacción verificada.
- Contactar abre WhatsApp con el teléfono de la ficha. El clic no confirma que se envió un mensaje ni que el trabajo se concretó.
- Los reportes generan una alerta para el administrador; enviar un reporte no elimina automáticamente una ficha.
- Cuotas y publicidad quedan fuera de este piloto.

## Datos

- El prototipo incluye las fichas de Teófilo Modesto, Leo Gisbert y Fernando, con datos aportados por el responsable del proyecto. El permiso para usarlas en la demo piloto fue confirmado; antes de un lanzamiento público amplio, volver a verificar alcance y vigencia.
- La ficha de Teófilo reúne los alias “Teófilo”, “Modesto” y “Modesto Viejo”.
- Los demás contactos históricos están en `materiales/candidatos-profesionales-interno.csv`; **no se muestran aquí** hasta revalidar su actividad y cargarlos bajo las reglas del piloto.
- Google login, altas, duplicados y reportes son simulaciones en memoria. No se guardan datos, no se crea una sesión real y los cambios se pierden al recargar.
- La normalización telefónica está limitada a formatos comunes del área de La Plata; el producto real requerirá validarla antes de usarla como clave de deduplicación.
- El archivo todavía no está publicado en una URL.

## Trazabilidad

- `#buscar`, `#resultados` y `#perfil` ← Story Map de Los Sauces: buscar por rubro/alias, evaluar datos y contactar.
- Alta y duplicados ← reglas acordadas de Google login para contribuyentes, celular normalizado, ficha comunitaria inmediata y autor privado por defecto.
- `#reportar` ← moderación reactiva: un administrador revisa tickets; no hay aprobación previa de profesionales.
- La última prueba reportada: **5 de 5 vecinos encontraron a Teófilo y abrieron WhatsApp**. Después se hizo más visible la opción para agregar profesionales. Esto valida el flujo probado, no trabajos concretados ni demanda sostenida.

## Assumptions alert

Este prototipo se construyó con la documentación de OFIDI, las decisiones conversadas, Story Maps de Miro, las fichas aportadas y el archivo histórico del grupo de WhatsApp.

Asumí que:
- La búsqueda por rubro o alias es comprensible y resuelve el problema de revisar el historial.
- El aporte comunitario inmediato es aceptable en el piloto si queda claramente marcado como **no verificado por OFIDI**.
- Google login alcanza para la trazabilidad interna del autor, aunque no demuestra que viva en Los Sauces.
- La contribución y el reporte son entendibles con la autenticación simulada de la demo.

El piloto debe revisar estas suposiciones antes de ampliarse a otros barrios o abrir el acceso públicamente.
