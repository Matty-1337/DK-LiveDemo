FROM docker.io/livedemo/livedemo-web-app:latest

# Create the missing file that webpack is looking for
RUN mkdir -p /app/src/utils && \
    printf 'export function resolveStoryDemoOuterBackground() { return null; }\nexport default {};\n' > /app/src/utils/storyDemoBackground.js

EXPOSE 5000
