FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY app/admin-web/package.json app/admin-web/package.json
COPY app/public-web/package.json app/public-web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

FROM deps AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY app app
COPY packages packages
COPY tsconfig.base.json tsconfig.base.json

RUN npm run build:contracts && npm run build --workspace @cjl/admin-web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/app/admin-web ./app/admin-web
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

EXPOSE 3001

USER node

CMD ["npm", "run", "start", "--workspace", "@cjl/admin-web"]
