# Base image ships Chromium + all shared libs Playwright needs — avoids
# the ~10-minute apt-get dance of installing Playwright system deps.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS build

WORKDIR /app
COPY package.json ./
# Skip Playwright browser download on install — the base image already has
# them at /ms-playwright. We point Playwright at them via env in the runner.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=optional
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ---- runtime ----
FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json ./
RUN npm install --omit=dev --omit=optional

COPY --from=build /app/dist ./dist

# Fastify listens on $PORT (Railway sets it); default 3200 for local
ENV PORT=3200
EXPOSE 3200

# Start as non-root. The playwright:jammy base has a 'pwuser' account.
USER pwuser
CMD ["node", "dist/index.js"]
