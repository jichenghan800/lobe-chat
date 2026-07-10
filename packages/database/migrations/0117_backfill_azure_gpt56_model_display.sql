-- Add Azure GPT-5.6 models to the existing Chat and Agent display lists.
-- Each update is independently idempotent so partially backfilled rows are repaired without duplicates.

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{chat}',
    COALESCE("config"->'chat', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Sol","enabled":true,"model":"gpt-5.6-sol","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'chat', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-sol'
  );
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{chat}',
    COALESCE("config"->'chat', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Terra","enabled":true,"model":"gpt-5.6-terra","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'chat', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-terra'
  );
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{chat}',
    COALESCE("config"->'chat', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Luna","enabled":true,"model":"gpt-5.6-luna","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'chat', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-luna'
  );
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{agent}',
    COALESCE("config"->'agent', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Sol","enabled":true,"model":"gpt-5.6-sol","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'agent', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-sol'
  );
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{agent}',
    COALESCE("config"->'agent', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Terra","enabled":true,"model":"gpt-5.6-terra","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'agent', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-terra'
  );
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{agent}',
    COALESCE("config"->'agent', '[]'::jsonb) ||
      '[{"displayName":"GPT-5.6 Luna","enabled":true,"model":"gpt-5.6-luna","provider":"azure"}]'::jsonb,
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'agent', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'azure' AND lower(item->>'model') = 'gpt-5.6-luna'
  );
