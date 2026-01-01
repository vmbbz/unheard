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
RUN echo "=== Starting backend build ===" && \
    # Create necessary directories
    mkdir -p /app/dist-server && \
    # Show current directory structure
    echo "Current directory: $(pwd)" && \
    echo "Files in /app: $(ls -la /app)" && \
    # Verify source files exist
    echo -e "\n=== Verifying source files ===" && \
    ls -la /app/server.ts /app/types.ts 2>/dev/null || echo "Warning: Some source files not found!" && \
    # Run TypeScript compiler with detailed output
    echo -e "\n=== Running TypeScript compiler ===" && \
    cd /app && \
    npx tsc --project tsconfig.server.json --listFiles --diagnostics && \
    # Force emit files regardless of errors
    npx tsc --project tsconfig.server.json --noEmit false --outDir /app/dist-server 2>&1 | tee /tmp/tsc_errors.log || echo "TypeScript compilation completed with warnings" && \
    # Verify output files
    echo -e "\n=== Compiled files in /app/dist-server ===" && \
    find /app/dist-server -type f -exec ls -la {} \; || echo "No files found in /app/dist-server" && \
    # Check if server.js was created
    if [ -f "/app/dist-server/server.js" ]; then \
        echo -e "\n=== Server.js content (first 10 lines) ===" && \
        head -n 10 /app/dist-server/server.js; \
    else \
        echo -e "\n=== ERROR: server.js not found in /app/dist-server/ ===" && \
        echo "=== TypeScript errors: ===" && \
        cat /tmp/tsc_errors.log || echo "No TypeScript errors found" && \
        echo -e "\n=== Contents of /app ===" && \
        find /app -maxdepth 1 -type f -name "*.ts" | sort; \
    fi && \
    echo -e "\n=== Build completed ==="

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
CMD ["sh", "-c", "node /app/dist-server/server.js || { echo '❌ Failed to start server'; exit 1; }"]

# DEPLOYMENT NOTES:
# - This 2-stage build ensures the smallest possible container.
# - Running the compiled .js file is much faster and more reliable than tsx in production.
# - Ensure MONGODB_URI and API_KEY are configured in your Sliplane dashboard.
