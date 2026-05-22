# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the FastAPI backend and final image
FROM python:3.9-slim-buster

# Install system dependencies (ffmpeg and libsndfile1 for sound processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements first to leverage caching
COPY backend/requirements.txt ./backend/

# Optimize PyTorch: Install CPU-only PyTorch to reduce image size drastically from 5GB+ to under 2GB (excluding models)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy all source files
COPY backend/ ./backend/

# Pre-download and bake models inside the Docker image during the build stage
# This caches them permanently in the image so they are ready instantly on startup
RUN python backend/download_models.py backend/models

# Copy the built React assets from Stage 1 into the backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 8000
EXPOSE 8000

# Set environment variable for port (Railway passes PORT env)
ENV PORT=8000

# Start Uvicorn serving both backend endpoints and compiled static UI
CMD ["sh", "-c", "uvicorn app:app --app-dir backend --host 0.0.0.0 --port ${PORT}"]
