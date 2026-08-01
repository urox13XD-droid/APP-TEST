# Build context is the repository root (see docker-compose.yml) because
# this app imports shared types from /shared/types.ts.
FROM node:22-slim AS deps
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /repo
COPY shared ./shared
COPY frontend ./frontend
COPY --from=deps /repo/frontend/node_modules ./frontend/node_modules
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /repo/frontend
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /repo/frontend
ENV NODE_ENV=production
COPY --from=builder /repo/frontend/.next ./.next
COPY --from=builder /repo/frontend/public ./public
COPY --from=builder /repo/frontend/package.json ./package.json
COPY --from=builder /repo/frontend/node_modules ./node_modules
COPY --from=builder /repo/frontend/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
