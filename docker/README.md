# docker/ — frontend arduino-wokwi-clone

Setup Docker buat app frontend ini saja (build Vite statis + nginx). Terpisah dari
`compile-server/` — itu servisnya sendiri dengan Docker setup sendiri
(`compile-server/Dockerfile` + `compile-server/docker-compose.yml`), jalan sebagai
container yang beda.

## Menjalankan

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Buka `http://localhost:3003`.

## Alamat compile-server

Frontend ini butuh compile-server (lihat `compile-server/README.md`) buat fitur
"Upload ke Board" — defaultnya `https://compile.codeteam.id` (`FALLBACK_COMPILE_SERVER_URL`
di `src/upload/compileServerSetting.ts`). Untuk pakai compile-server sendiri:

- **Tanpa build ulang**: buka dialog Pengaturan di app, isi alamat compile-server sendiri.
  Tersimpan di localStorage browser siswa.
- **Dibakar saat build**: isi `args.VITE_COMPILE_SERVER_URL` di `docker-compose.yml`, lalu
  `docker compose -f docker/docker-compose.yml up -d --build` lagi.

## Catatan

- Build context Dockerfile ini adalah root proyek (`..`), bukan folder `docker/` — supaya
  `src/`, `index.html`, dll ikut kebawa saat build. File yang di-skip saat build diatur di
  `docker/Dockerfile.dockerignore` (bukan `.dockerignore` di root).
- Port host `3003` bisa diganti di `docker-compose.yml` kalau bentrok.
