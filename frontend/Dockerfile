FROM docker.io/livedemo/livedemo-web-app:latest

# Create the missing file that webpack is looking for
RUN mkdir -p /app/src/utils && \
    echo "export default {};" > /app/src/utils/storyDemoBackground.js

EXPOSE 5000
