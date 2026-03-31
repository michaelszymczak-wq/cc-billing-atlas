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
COPY --from=build /app/backend/src/assets backend/dist/assets

ENV PORT=3001
ENV USE_FIRESTORE=true

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
