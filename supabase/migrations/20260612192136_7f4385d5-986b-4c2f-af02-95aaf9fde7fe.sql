-- Reestrutura etapas do funil
ALTER TYPE lead_etapa RENAME TO lead_etapa_old;

CREATE TYPE lead_etapa AS ENUM (
  'novos_leads',
  'em_atendimento',
  'reuniao_agendada',
  'documentos_enviados',
  'em_negociacao',
  'follow_up',
  'fechado',
  'descartado'
);

ALTER TABLE leads ALTER COLUMN etapa DROP DEFAULT;
ALTER TABLE leads
  ALTER COLUMN etapa TYPE lead_etapa
  USING (
    CASE etapa::text
      WHEN 'visita_agendada'  THEN 'reuniao_agendada'
      WHEN 'proposta_enviada' THEN 'documentos_enviados'
      WHEN 'fechado_ganho'    THEN 'fechado'
      WHEN 'fechado_perdido'  THEN 'descartado'
      ELSE etapa::text
    END
  )::lead_etapa;
ALTER TABLE leads ALTER COLUMN etapa SET DEFAULT 'novos_leads'::lead_etapa;

DROP TYPE lead_etapa_old;