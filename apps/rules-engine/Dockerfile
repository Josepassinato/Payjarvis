FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json turbo.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/rules-engine/ ./apps/rules-engine/
RUN npm ci
RUN npx turbo build --filter=@payjarvis/rules-engine

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/apps/rules-engine/dist ./dist
COPY --from=builder /app/apps/rules-engine/package.json .
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/server.js"]
