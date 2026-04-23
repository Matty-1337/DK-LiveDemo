FROM docker.io/livedemo/livedemo-web-app:latest

# Create the missing file that webpack is looking for
RUN mkdir -p /app/src/utils && \
    printf 'export function resolveStoryDemoOuterBackground() { return null; }\nexport default {};\n' > /app/src/utils/storyDemoBackground.js

# Allow Railway internal hostname through Vite's host check.
# Caddy upstreams with Host=livedemo-frontend.railway.internal:5000, so
# only that hostname needs to be allowed (explicit list keeps Vite's DNS
# rebinding protection active). Fails the build if the sed never matches.
RUN sed -i "s|server: {|server: { allowedHosts: ['livedemo-frontend.railway.internal'],|" /app/vite.config.js && \
    grep -q "allowedHosts: \['livedemo-frontend.railway.internal'\]" /app/vite.config.js

EXPOSE 5000
