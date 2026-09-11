\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=public;
SET LOCAL lock_timeout='10s';
LOCK TABLE agents, topics, tasks, cotti_model_display_settings IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE c jsonb; scope text;
DECLARE source_ref jsonb := '{"provider":"azure","model":"gpt-5.6-sol"}';
DECLARE target_ref jsonb := '{"provider":"azure","model":"gpt-5.6-terra"}';
BEGIN
 SELECT config INTO STRICT c FROM cotti_model_display_settings WHERE id='default';
 FOREACH scope IN ARRAY ARRAY['chat','agent'] LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c->scope) x WHERE x @> target_ref AND x->>'enabled'='true') THEN
   RAISE EXCEPTION 'Terra must be enabled in both scopes';
  END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(c->'retirements','[]')) x
  WHERE x->'source' @> target_ref OR (x->'source' @> source_ref AND NOT x->'target' @> target_ref)) THEN
  RAISE EXCEPTION 'Retirement configuration changed; review before release';
 END IF;
 FOREACH scope IN ARRAY ARRAY['chat','agent'] LOOP
  c := jsonb_set(c, ARRAY[scope], (SELECT jsonb_agg(CASE WHEN x @> source_ref THEN x || '{"enabled":false}' ELSE x END ORDER BY ord)
    FROM jsonb_array_elements(c->scope) WITH ORDINALITY a(x,ord)));
  IF c->'defaults'->scope @> source_ref THEN
   c := jsonb_set(c, ARRAY['defaults',scope], target_ref);
  END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(c->'retirements','[]')) x WHERE x->'source' @> source_ref) THEN
  c := jsonb_set(c, '{retirements}', COALESCE(c->'retirements','[]') || jsonb_build_array(jsonb_build_object(
    'source',source_ref,'target',target_ref,'by','production-release-20260911','at',now())));
 END IF;
 UPDATE cotti_model_display_settings SET config=c, updated_at=now() WHERE id='default' AND config IS DISTINCT FROM c;
END $$;
UPDATE tasks SET config=config || jsonb_build_object('model','gpt-5.6-terra','provider','azure',
 'cottiModelMigrations', COALESCE(config->'cottiModelMigrations','[]') || jsonb_build_array(jsonb_build_object(
 'at',now(),'by','production-release-20260911','from',jsonb_build_object('model','gpt-5.6-sol','provider','azure'),
 'to',jsonb_build_object('model','gpt-5.6-terra','provider','azure')))), updated_at=now()
 WHERE lower(trim(config->>'model'))='gpt-5.6-sol' AND lower(trim(config->>'provider'))='azure';
UPDATE agents SET model='gpt-5.6-terra',provider='azure',updated_at=now()
 WHERE lower(trim(model))='gpt-5.6-sol' AND lower(trim(provider))='azure';
UPDATE topics SET model='gpt-5.6-terra',provider='azure',updated_at=now()
 WHERE lower(trim(model))='gpt-5.6-sol' AND lower(trim(provider))='azure';
-- Historical messages and actual billing model attribution remain intact.
COMMIT;
