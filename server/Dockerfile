FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app/server
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--experimental-strip-types", "--watch", "index.ts"]
