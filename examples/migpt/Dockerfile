# ==================================
# Multi-stage build for MiGPT project
# ==================================

# Builder stage: use rust image for better compatibility
FROM rust:1.86-slim AS rust-builder

WORKDIR /app

# Install Node.js in Rust image
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        pkg-config \
        libssl-dev \
        ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy project files
COPY examples/migpt .
COPY packages/client-rust ./client-rust

# Enable pnpm and install dependencies
RUN corepack enable && \
    pnpm install

# Fix Rust path and build
RUN sed -i 's/\.\.\/\.\.\/packages\///g' Cargo.toml && \
    rm -f Cargo.lock && \
    pnpm build

# ==================================
# Production stage: optimized runtime environment
# ==================================
FROM node:22-slim AS production

WORKDIR /app

# Install runtime dependencies and tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # SSH tools for remote execution
        openssh-client \
        sshpass \
        # Text editors and utilities
        nano \
        # System monitoring tools
        procps \
        htop \
        # Build tools (for potential runtime compilation)
        build-essential \
        pkg-config \
        libssl-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Rust (for potential runtime recompilation)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    echo 'source $HOME/.cargo/env' >> ~/.bashrc
ENV PATH="/root/.cargo/bin:${PATH}"

# Enable pnpm
RUN corepack enable

# Copy built application from builder stage
COPY --from=rust-builder /app/migpt ./migpt
COPY --from=rust-builder /app/package.json ./package.json
COPY --from=rust-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=rust-builder /app/tsconfig.json ./tsconfig.json
COPY --from=rust-builder /app/Cargo.toml ./Cargo.toml
COPY --from=rust-builder /app/web ./web

# Install production dependencies
RUN pnpm install && \
    pnpm store prune

# Create directories for configuration and logs
RUN mkdir -p /app/config /app/logs

# Set proper permissions
RUN chmod +x /app/migpt/* 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose ports
EXPOSE 3000 4399

# Use bash as default shell for better compatibility
SHELL ["/bin/bash", "-c"]

# Set environment variables
ENV NODE_ENV=production
ENV PATH="/app/migpt:${PATH}"

# Default command
CMD ["pnpm", "start"]