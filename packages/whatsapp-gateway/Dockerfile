FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/whatsapp-gateway/package.json packages/whatsapp-gateway/package.json

RUN npm ci

FROM deps AS builder
WORKDIR /app

COPY packages packages
COPY tsconfig.base.json tsconfig.base.json

RUN npm run build:contracts && npm run build:whatsapp

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/whatsapp-gateway ./packages/whatsapp-gateway
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 4100

CMD ["npm", "run", "start", "--workspace", "@cjl/whatsapp-gateway"]
