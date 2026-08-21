FROM node:20-bullseye-slim

# Install ALL Chromium runtime dependencies (cloakbrowser's patched Chromium needs these)
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    libxshmfence1 libdrm2 \
    dbus dbus-x11 \
    wget xdg-utils procps \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install project dependencies first (Docker layer cache)
COPY package*.json ./
RUN npm install

# Pre-download the cloakbrowser Chromium binary during build (not at runtime)
RUN npx cloakbrowser install

# Copy application code
COPY . .

# Create startup script that starts webcmd daemon before the server
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting webcmd daemon..."\n\
npx webcmd daemon restart 2>&1 || true\n\
sleep 2\n\
echo "Checking webcmd status..."\n\
npx webcmd doctor 2>&1 || true\n\
echo "Starting HackScout server..."\n\
exec node server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]
