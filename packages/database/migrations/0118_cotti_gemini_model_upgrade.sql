-- Upgrade the persisted COTTI Gemini mappings without changing list order, enabled states,
-- display names, or unrelated administrator-managed model entries.

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{chat}',
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN lower(item->>'provider') = 'vertexai'
              AND lower(item->>'displayName') = lower('COTTI-快速')
              AND lower(item->>'model') = 'gemini-3.1-flash-lite'
              THEN jsonb_set(item, '{model}', '"gemini-3.5-flash-lite"'::jsonb, false)
            WHEN lower(item->>'provider') = 'vertexai'
              AND lower(item->>'displayName') = lower('COTTI-专业')
              AND lower(item->>'model') = 'gemini-3.5-flash'
              THEN jsonb_set(item, '{model}', '"gemini-3.6-flash"'::jsonb, false)
            ELSE item
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(COALESCE("config"->'chat', '[]'::jsonb))
          WITH ORDINALITY AS entries(item, ordinality)
      ),
      '[]'::jsonb
    ),
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'chat', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'vertexai'
      AND (
        (
          lower(item->>'displayName') = lower('COTTI-快速')
          AND lower(item->>'model') = 'gemini-3.1-flash-lite'
        )
        OR (
          lower(item->>'displayName') = lower('COTTI-专业')
          AND lower(item->>'model') = 'gemini-3.5-flash'
        )
      )
  );
--> statement-breakpoint

-- Existing users keep their selected model on the agents row, so upgrade the active configuration
-- as well. Historical message, topic, tracing, and audit rows intentionally remain unchanged.
UPDATE "agents"
SET
  "model" = CASE
    WHEN lower("model") = 'gemini-3.1-flash-lite' THEN 'gemini-3.5-flash-lite'
    WHEN lower("model") = 'gemini-3.5-flash' THEN 'gemini-3.6-flash'
    ELSE "model"
  END,
  "updated_at" = now()
WHERE lower("provider") = 'vertexai'
  AND lower("model") IN ('gemini-3.1-flash-lite', 'gemini-3.5-flash');
--> statement-breakpoint

UPDATE "cotti_model_display_settings"
SET
  "config" = jsonb_set(
    "config",
    '{agent}',
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN lower(item->>'provider') = 'vertexai'
              AND lower(item->>'displayName') = lower('COTTI-快速')
              AND lower(item->>'model') = 'gemini-3.1-flash-lite'
              THEN jsonb_set(item, '{model}', '"gemini-3.5-flash-lite"'::jsonb, false)
            WHEN lower(item->>'provider') = 'vertexai'
              AND lower(item->>'displayName') = lower('COTTI-专业')
              AND lower(item->>'model') = 'gemini-3.5-flash'
              THEN jsonb_set(item, '{model}', '"gemini-3.6-flash"'::jsonb, false)
            ELSE item
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(COALESCE("config"->'agent', '[]'::jsonb))
          WITH ORDINALITY AS entries(item, ordinality)
      ),
      '[]'::jsonb
    ),
    true
  ),
  "updated_at" = now()
WHERE "id" = 'default'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE("config"->'agent', '[]'::jsonb)) AS item
    WHERE lower(item->>'provider') = 'vertexai'
      AND (
        (
          lower(item->>'displayName') = lower('COTTI-快速')
          AND lower(item->>'model') = 'gemini-3.1-flash-lite'
        )
        OR (
          lower(item->>'displayName') = lower('COTTI-专业')
          AND lower(item->>'model') = 'gemini-3.5-flash'
        )
      )
  );
