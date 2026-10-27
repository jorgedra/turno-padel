# Turno Pádel

PWA mínima para saber a quién le toca pagar la pista. Sin servidor ni base de datos: los datos se guardan en el propio móvil (`localStorage`).

## Uso
- **Registrar pago**: apunta el pago de quien le toca y pasa al siguiente. Sale un aviso con *Deshacer* durante unos segundos.
- **¿Ha pagado otro?**: registra un pago fuera de turno. El turno sigue desde quien pagó.
- **⚙**: renombrar, reordenar, añadir o quitar jugadores, y exportar/importar una copia de seguridad (JSON).

## Probar en local
```bash
python -m http.server 5173
```

## Desplegar en Vercel
Sitio estático, sin build. En vercel.com → *Add New → Project*, sube la carpeta (o conecta un repo) con *Framework: Other*. O con la CLI:
```bash
npx vercel --prod
```
Después abre la URL en el móvil → *Añadir a pantalla de inicio*.

## Al cambiar el código
Sube el número en `CACHE` de `service-worker.js` (`turno-padel-v2`, …) para forzar que el móvil descargue la versión nueva.
