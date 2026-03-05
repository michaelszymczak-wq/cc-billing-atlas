# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install all dependencies
RUN npm ci

# Copy source
COPY backend/ backend/
COPY frontend/ frontend/

# Build frontend → backend/public, then backend → backend/dist
RUN npm run build -w frontend && npm run build -w backend

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/public backend/public

# Create data directory for config persistence
RUN mkdir -p /data

ENV PORT=3001
ENV CONFIG_PATH=/data/.innovint-billing-config.json

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
