FROM lobehub/lobehub@sha256:b51561ee77c7c4299b5f158d6fb3c71137d98abb89a248b782b93d8956db661d
USER root
COPY patch.mjs /tmp/cotti-pdf-patch.mjs
RUN node /tmp/cotti-pdf-patch.mjs && rm /tmp/cotti-pdf-patch.mjs
LABEL com.cotti.patch="v2.2.16-pdf-uint8array" \
      com.cotti.upstream.revision="906b10e03029648655e0257bda4f785a9e0973f0"
USER nextjs
