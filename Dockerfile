# Dev image for the Next.js app. Deps are installed into the image so the
# node_modules volume (declared in compose.yml) is populated with Linux-native
# binaries, while your source is bind-mounted for live reload.
FROM node:24-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
