FROM lobehub:lingshu-v2216-overview-sort-20260913-r2
USER root
RUN rm -rf /app && mkdir -p /app
COPY --chown=1001:1001 standalone/ /app/
COPY --chown=1001:1001 static/ /app/.next/static/
COPY --chown=1001:1001 public/ /app/public/
COPY --chown=1001:1001 migrations/ /app/migrations/
COPY --chown=1001:1001 shared/ /app/scripts/_shared/
COPY --chown=1001:1001 startServer.js docker.cjs errorHint.js /app/
RUN test ! -e /app/.env && test ! -e /app/.env.local && test ! -e /app/.records
LABEL com.cotti.upstream.version="2.2.17" com.cotti.upgrade.phase="customization-acceptance"
USER nextjs
WORKDIR /app
