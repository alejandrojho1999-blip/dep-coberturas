-- El registro de alertas decía «enviado» cuando solo estaba «aceptado».
--
-- El puente de Nexus responde `202 queued` en cuanto recibe la petición y hace
-- el envío después, de forma asíncrona. Cuando la sesión de WhatsApp está
-- caída sigue devolviendo 202 y el fallo aparece en su log medio minuto más
-- tarde, así que `enviado_at` se rellenaba con un mensaje que nunca llegó al
-- teléfono. Ocurrió de verdad el 2026-08-31: dos alertas quedaron marcadas como
-- enviadas con la sesión de `nexus` desvinculada.
--
-- El campo pasa a llamarse por lo que de verdad significa y se añade el estado
-- del canal en el momento del envío, que es lo más cerca que se puede estar de
-- saber si el mensaje llegará.

ALTER TABLE alert_signals RENAME COLUMN enviado_at TO aceptado_at;

COMMENT ON COLUMN alert_signals.aceptado_at IS
  'Momento en que el puente de Nexus aceptó el mensaje (202 queued). No garantiza la entrega en WhatsApp: el envío es asíncrono. Ver canal_estado.';

ALTER TABLE alert_signals
  ADD COLUMN IF NOT EXISTS canal_estado text
    CHECK (canal_estado IN ('vivo', 'caido', 'desconocido')),
  ADD COLUMN IF NOT EXISTS canal_detalle text;

COMMENT ON COLUMN alert_signals.canal_estado IS
  'Estado de la sesión de WhatsApp de Nexus justo antes del envío, según OpenClaw. "caido" significa que el mensaje quedó encolado pero no se entregó.';

-- Las filas anteriores a esta migración se escribieron cuando el sistema no
-- sabía distinguir aceptación de entrega. Marcarlas como "vivo" sería repetir
-- la misma mentira, así que se dejan explícitamente como desconocidas.
UPDATE alert_signals
SET canal_estado = 'desconocido',
    canal_detalle = 'anterior a la migración 023: no se comprobaba el estado del canal'
WHERE canal_estado IS NULL;
