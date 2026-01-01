# AURA & ECHO - OPTIMIZED PRODUCTION DOCKERFILE

# --- STAGE 1: Build Stage ---
FROM node:20-slim AS build
WORKDIR /app

# Install all dependencies including devDependencies for compilation
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and config
COPY tsconfig.json vite.config.ts index.html ./
COPY . .

# 1. Build Frontend Assets (Vite)
RUN npm run build

# 2. Build Backend (Compile TS to JS for production stability)
RUN mkdir -p dist-server && \
    npx tsc --project tsconfig.server.json && \
    echo '{"type": "module"}' > dist-server/package.json && \
    ls -la dist-server/  # Debug: List files in dist-server

# --- STAGE 2: Production Stage ---
FROM node:20-slim
WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy built backend files
COPY --from=build /app/dist-server/ ./

# Copy types for any runtime needs (if applicable)
COPY types.ts ./

# Environment setup
ENV PORT=4000
ENV NODE_ENV=production
EXPOSE 4000

# Run with Node.js in ES modules mode
CMD ["node", "--experimental-specifier-resolution=node", "server.js"]

# DEPLOYMENT NOTES:
# - This 2-stage build ensures the smallest possible container.
# - Running the compiled .js file is much faster and more reliable than tsx in production.
# - Ensure MONGODB_URI and API_KEY are configured in your Sliplane dashboard.
