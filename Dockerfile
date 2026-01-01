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
RUN echo "=== Building backend ===" && \
    # Install production dependencies only for backend
    npm install --omit=dev && \
    # Create necessary directories
    mkdir -p /app/dist-server && \
    # Build the server
    echo "=== Compiling TypeScript (backend) ===" && \
    npx tsc -p tsconfig.server.json && \
    # Verify output files
    echo -e "\n=== Compiled files in /app/dist-server ===" && \
    ls -la /app/dist-server/ && \
    # Check if server.js was created
    if [ -f "/app/dist-server/server.js" ]; then \
        echo -e "\n✅ Backend build successful" && \
        echo "File size: $(du -h /app/dist-server/server.js | cut -f1)"; \
    else \
        echo -e "\n❌ ERROR: Backend build failed - server.js not found" && \
        exit 1; \
    fi

# --- STAGE 2: Production Stage ---
FROM node:20-slim
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy built backend files and verify
COPY --from=build /app/dist-server /app/dist-server/

# Set working directory and verify files
WORKDIR /app

# Verify files were copied correctly
RUN echo -e "\n=== Verifying production files ===" && \
    echo "Current directory: $(pwd)" && \
    echo -e "\n=== Directory structure ===" && \
    ls -la /app && \
    echo -e "\n=== dist-server contents ===" && \
    ls -la /app/dist-server/ 2>/dev/null || echo "dist-server not found" && \
    echo -e "\n=== Checking for server.js ===" && \
    if [ -f "/app/dist-server/server.js" ]; then \
        echo "✅ server.js found!" && \
        echo "File size: $(du -h /app/dist-server/server.js | cut -f1)" && \
        echo -e "\nFirst 5 lines:" && \
        head -n 5 /app/dist-server/server.js; \
    else \
        echo "❌ ERROR: server.js not found in /app/dist-server/" && \
        echo -e "\nSearching for JavaScript files..." && \
        find /app -name "*.js" | sort; \
        exit 1; \
    fi

# Environment setup
ENV PORT=4000
ENV NODE_ENV=production
EXPOSE 4000

# Run the server from the correct location with error handling
CMD ["sh", "-c", "node /app/dist-server/server.js" || { echo '❌ Failed to start server'; exit 1; }]

# DEPLOYMENT NOTES:
# - This 2-stage build ensures the smallest possible container.
# - Running the compiled .js file is much faster and more reliable than tsx in production.
# - Ensure MONGODB_URI and API_KEY are configured in your Sliplane dashboard.
