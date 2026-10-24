# Frontend arduino-wokwi-clone (Vite + React) — build statis, disajikan nginx.
# Build context = root proyek (bukan folder docker/ ini), supaya src/, index.html, dst
# ikut kebawa. Jalankan dari root: `docker build -f docker/Dockerfile -t arduino-simulator .`
# atau lebih gampang lewat `docker compose -f docker/docker-compose.yml up -d --build`.
FROM node:20-bookworm-slim AS build
WORKDIR /app

# URL compile-server dibakar ke build kalau diisi (opsional) — kalau kosong, app tetap
# jalan dan pakai FALLBACK_COMPILE_SERVER_URL bawaan (lihat compileServerSetting.ts).
# Siswa juga bisa override sendiri lewat dialog Pengaturan tanpa build ulang.
ARG VITE_COMPILE_SERVER_URL=
ENV VITE_COMPILE_SERVER_URL=$VITE_COMPILE_SERVER_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
