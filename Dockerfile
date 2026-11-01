# Heather in one container: every bot plus the manager run in this one process.
# Mount your tokens.txt into /app, e.g.:
#   docker run -d --name heather -v "$PWD/tokens.txt:/app/tokens.txt" -e MANAGER_TOKEN=... heather
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY *.js tokens.example.txt ./

ENV HEADLESS=1
EXPOSE 8080
CMD ["node", "index.js"]
