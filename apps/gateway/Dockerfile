FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=@atreides/gateway --include-workspace-root

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY package.json package-lock.json ./
COPY apps/gateway ./apps/gateway
EXPOSE 4100
CMD ["npm", "run", "start", "--workspace=@atreides/gateway"]
