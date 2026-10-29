# OFIDI · Oficios de Los Sauces

## Qué es

**OFIDI** es un directorio comunitario para vecinos de **Los Sauces, La Plata**. Su objetivo es resolver una necesidad cotidiana: encontrar un profesional, oficio o servicio sin tener que revisar el historial del grupo de WhatsApp.

El piloto reúne referencias del barrio para que sea más fácil buscar, comparar y contactar profesionales.

**Sitio:** <https://ofidi.netlify.app>

## Cómo funciona

### Buscar

La búsqueda es abierta. Cualquier persona puede:

- Buscar por nombre, alias, oficio o rubro.
- Usar categorías rápidas, por ejemplo Electricidad, Plomería y piletas o Jardinería y poda.
- Abrir una ficha y leer referencias u opiniones comunitarias.
- Ver el promedio de estrellas y la cantidad de opiniones cuando existan.

Las fichas sin puntajes muestran **“Sin opiniones aún”**: no se interpreta como una mala referencia.

### Ver teléfonos y contactar

Para ver teléfonos y abrir WhatsApp, el vecino debe:

1. Ingresar con su cuenta Google.
2. Validar el código de invitación del barrio.

Esto ayuda a limitar el acceso a contactos dentro del piloto. El clic en **Contactar por WhatsApp** solo registra que se abrió el enlace: no confirma que haya conversación ni trabajo realizado.

### Aportar un profesional

Un vecino con acceso puede sumar una ficha indicando:

- Nombre o comercio.
- Celular del profesional.
- Rubro elegido de una lista estandarizada.
- Motivo de la recomendación.
- Estrellas opcionales.
- Confirmación de que puede compartir el teléfono.

La ficha se publica de inmediato como **aporte de la comunidad**. No requiere que el profesional tenga cuenta ni una aprobación previa del administrador.

Si el celular ya existe, OFIDI no crea un duplicado: suma la recomendación a la ficha existente. No fusiona contactos solo por nombres similares.

Si el rubro no está en la lista, se puede elegir **“+ Otro rubro…”**. La ficha queda visible como rubro sugerido y el administrador puede aprobar ese rubro para incorporarlo a la lista oficial.

### Dejar una opinión

Desde la ficha de un profesional existente, un vecino autorizado puede dejar:

- Estrellas.
- Un comentario.
- O ambos.

Las opiniones se muestran públicamente dentro de la ficha. La identidad del vecino queda privada salvo que elija mostrar su nombre.

### Reportar un problema

Los vecinos pueden reportar teléfonos incorrectos, profesionales que ya no ofrecen el servicio, experiencias para revisar u otros problemas.

Un reporte crea un ticket para administración. **No elimina ni oculta una ficha automáticamente.** El administrador puede:

- Dejarlo abierto o ponerlo en revisión.
- Resolverlo o descartarlo.
- Desactivar una ficha si corresponde.
- Restaurar una ficha desactivada desde la papelera administrativa.

## Principios del piloto

- Las referencias, estrellas y comentarios son aportes vecinales; **OFIDI no verifica profesionalmente a los prestadores ni garantiza resultados**.
- Google identifica a quien aporta o reporta, pero no demuestra residencia por sí solo; el código de invitación complementa el acceso interno.
- No hay cobros, publicidad ni comisiones en este piloto.
- Se miden búsquedas y clics en Contactar, no conversaciones, contrataciones ni trabajos completados.
- El registro histórico inicial se presenta como fuente histórica; no equivale a actividad vigente ni a un trabajo confirmado.

## Categorías iniciales

- Atmosférico
- Bombas
- Lavadero
- Cerrajería
- Contenedores
- Electricidad
- Jardinería y poda
- Plomería y piletas
- Pozos
- Volquetes

## Estado del piloto

- Sitio publicado en Netlify.
- Acceso con Google y código de barrio configurado.
- Base de datos con contactos iniciales importados.
- Administración de reportes y fichas disponible.
- Las mejoras de opiniones directas, rubros sugeridos, reputación en tarjetas, papelera y bandeja de reportes requieren que se apliquen las migraciones incrementales y se publique la última carpeta `web/`.
