FROM lobehub/lobehub@sha256:b51561ee77c7c4299b5f158d6fb3c71137d98abb89a248b782b93d8956db661d
USER root
RUN rm -rf /app/.next /app/public/_spa /app/public/_spa-auth /app/public/_spa-share /app/public/_spa-workbench /app/dist
COPY --chown=1001:1001 standalone/ /app/
COPY --chown=1001:1001 static/ /app/.next/static/
COPY --chown=1001:1001 public/ /app/public/
COPY --chown=1001:1001 migrations/ /app/migrations/
RUN test ! -e /app/.env && test ! -e /app/.env.local && test ! -e /app/.records
LABEL com.cotti.changes="DEV-001,DEV-002,DEV-003,DEV-004,DEV-005,DEV-006,DEV-007,DEV-008,DEV-009,DEV-010,DEV-011,DEV-012,DEV-013,DEV-014,DEV-015,DEV-016,DEV-017,DEV-018,DEV-019,DEV-020,DEV-021,DEV-022,DEV-023,DEV-024,DEV-025,DEV-026,DEV-027,DEV-028,DEV-029,DEV-030,DEV-031,DEV-032,DEV-033,DEV-034,DEV-035,DEV-036,DEV-037,DEV-038,DEV-039" \
      com.cotti.upstream.revision="906b10e03029648655e0257bda4f785a9e0973f0"
COPY --chown=1001:1001 startServer.js /app/startServer.js
USER nextjs
