# ==============================================================================
# AIAIC Farmers Platform - Production Dockerfile (SSR / BFF)
# Multi-stage build for TanStack Start + Nitro SSR Node.js runtime
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Image
# ------------------------------------------------------------------------------
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Copy dependency specifications
COPY farmer-s-friend-dashboard-main/package.json farmer-s-friend-dashboard-main/bun.lock ./

# Clean install all dependencies using Bun lockfile
RUN bun install --frozen-lockfile

# Copy full application source code
COPY farmer-s-friend-dashboard-main/ ./

# Define build arguments for client and SSR environment variables
ARG SUPABASE_PROJECT_ID="fhwwpasgebufuznthynv"
ARG SUPABASE_PUBLISHABLE_KEY="sb_publishable_xTto2I1cQ0IXM3YK83u4vw_IZJeFsol"
ARG SUPABASE_URL="https://fhwwpasgebufuznthynv.supabase.co"
ARG VITE_SUPABASE_PROJECT_ID="fhwwpasgebufuznthynv"
ARG VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xTto2I1cQ0IXM3YK83u4vw_IZJeFsol"
ARG VITE_SUPABASE_URL="https://fhwwpasgebufuznthynv.supabase.co"
ARG AIAIC_BASE_URL="http://163.128.209.18:8017"
ARG PLANT_BASE_URL=""

# Map build arguments to environment variables for Nitro/Vite bundling
ENV SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID \
    SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY \
    SUPABASE_URL=$SUPABASE_URL \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    AIAIC_BASE_URL=$AIAIC_BASE_URL \
    PLANT_BASE_URL=$PLANT_BASE_URL \
    NITRO_PRESET=node-server \
    NODE_ENV=production

# Build the production standalone SSR bundle (.output/)
RUN bun run build

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for container health checks
RUN apk add --no-cache curl

# Create non-privileged user and group for security hardening
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set production runtime environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy compiled standalone output from build stage
COPY --from=build --chown=appuser:appgroup /app/.output ./.output

# Switch to non-root user
USER appuser

# Expose internal SSR server port
EXPOSE 3000

# Native Docker Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the standalone Nitro SSR application server
CMD ["node", ".output/server/index.mjs"]
