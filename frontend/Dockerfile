# Multi-stage Dockerfile for building and running the Next.js app
FROM node:20 AS builder
WORKDIR /app

# Accept API URL as build argument (for NEXT_PUBLIC_ env vars that are baked at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Install pnpm via corepack and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

########## Production image ##########
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Enable corepack (pnpm) in the runtime image (optional but harmless)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only the files needed to run the built app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

# Run Next.js production server
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
