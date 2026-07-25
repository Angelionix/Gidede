# Multi-stage Dockerfile for Gidede (Next.js 16)
# Build: docker build -t gidede .
# Run:   docker run -p 3000:3000 -v $(pwd)/db:/app/db gidede

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-slim AS deps
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-slim AS builder
WORKDIR /app

RUN npm install -g bun

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install only production dependencies
COPY package.json bun.lock* ./
RUN npm install -g bun && bun install --frozen-lockfile --production

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Create db directory
RUN mkdir -p /app/db

# Expose port
EXPOSE 3000

# Health check — uses node's built-in http module (no curl needed on node:20-slim)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get({host:'localhost',port:3000,path:'/api/v1/health',timeout:5000},res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.on('timeout',()=>{r.destroy();process.exit(1)})"

# Start
CMD ["bun", "run", "start"]
