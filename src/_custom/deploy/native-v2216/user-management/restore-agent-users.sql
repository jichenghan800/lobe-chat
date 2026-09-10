-- One-time backfill after creating cotti_user_policies, before switching application traffic.
-- Preserve the retired allowlist's mailbox-prefix semantics for EXISTING users only.
-- Disabled rules never grant access; an independent enabled prefix can still match.
-- Retry-safe: never overwrite subsequent administrator edits.
INSERT INTO cotti_user_policies (user_id, vip, agent_enabled, topic_limit_fen, updated_by)
SELECT u.id, false, EXISTS (
  SELECT 1 FROM cotti_agent_access_rules r
  WHERE r.enabled AND (
    (r.type = 'userId' AND trim(r.value) = u.id)
    OR (r.type = 'email' AND split_part(lower(trim(r.value)), '@', 1) <> '' AND
      split_part(lower(trim(r.value)), '@', 1) IN (
        split_part(lower(trim(u.email)), '@', 1),
        split_part(lower(trim(u.normalized_email)), '@', 1)
      ))
  )
), NULL, 'migration:legacy-agent-allowlist'
FROM users u
ON CONFLICT (user_id) DO NOTHING;
