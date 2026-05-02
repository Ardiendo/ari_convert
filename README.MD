# ARI_CONVERT

> **Cyberpunk Edgerunners video creation tool** — convierte secuencias de imágenes en vídeos MP4 con estilo Night City.

---

## Vista previa

```
╔══════════════════════════════════════════════╗
║  ARI_CONVERT // EDGE_RUNNER_TECH v1.0        ║
║  IMAGE_SEQUENCE → VIDEO_SYNTHESIS            ║
╚══════════════════════════════════════════════╝
```

Dashboard con estética cyberpunk Edgerunners: fondo oscuro, neones rojo/cian/amarillo, consola de comandos en tiempo real, animaciones glitch, tarjetas con decoraciones angulares y efectos scanline.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Fuentes | Orbitron · Share Tech Mono |
| Backend | Express 5 + TypeScript |
| Video | Python 3 + MoviePy 2 |
| Monorepo | pnpm workspaces |
| API | OpenAPI + Orval codegen |

---

## Características

- **Subida de imágenes** — drag & drop o selección múltiple (PNG, JPG, WEBP, BMP)
- **Galería organizada** — miniaturas con numeración, nombre, tamaño y opción de borrar
- **Configuración completa** — FPS, duración por fotograma, transición (none / fade / crossfade), resolución y nombre del archivo de salida
- **Ordenación** — por nombre (natural sort), fecha ascendente o descendente
- **Consola en tiempo real** — log de operaciones con timestamps y niveles INFO / OK / ERR
- **Barra de progreso** — segmentada con gradiente neón rojo → cian
- **Descarga directa** — botón de extracción cuando el vídeo está listo
- **Script standalone** — `ari_convert.py` ejecutable desde línea de comandos

---

## Estructura del proyecto

```
ari_convert/
├── ari_convert.py                  # Script Python standalone
├── artifacts/
│   ├── api-server/                 # Backend Express
│   │   ├── src/
│   │   │   └── routes/video.ts     # Endpoints upload/generate/status/download
│   │   └── data/
│   │       ├── images/             # Imágenes subidas (excluido de git)
│   │       └── videos/             # Vídeos generados (excluido de git)
│   └── video-dashboard/            # Frontend React
│       └── src/
│           ├── components/
│           │   ├── cyber/          # Componentes cyberpunk propios
│           │   │   ├── GlitchText.tsx
│           │   │   ├── CyberCard.tsx
│           │   │   ├── CommandConsole.tsx
│           │   │   └── NeonBadge.tsx
│           │   └── ui/             # shadcn/ui
│           ├── pages/
│           │   └── dashboard.tsx   # Dashboard principal
│           └── index.css           # Tema cyberpunk completo
└── lib/
    ├── api-spec/                   # OpenAPI spec
    ├── api-zod/                    # Zod schemas generados
    └── api-client-react/           # React Query hooks generados
```

---

## Instalación y uso

### Requisitos

- Node.js 20+
- pnpm 9+
- Python 3.10+
- `moviepy` y `Pillow`

```bash
pip install moviepy pillow
```

### Desarrollo

```bash
# Instalar dependencias
pnpm install

# Regenerar hooks de API (tras cambiar openapi.yaml)
pnpm --filter @workspace/api-spec run codegen

# Los workflows de Replit arrancan automáticamente:
# - artifacts/api-server   → API en /api/
# - artifacts/video-dashboard → Dashboard en /video-dashboard/
```

### Script standalone

```bash
python ari_convert.py --help

# Ejemplo básico
python ari_convert.py \
  --input ./mis_imagenes \
  --output video_final.mp4 \
  --fps 30 \
  --duration 2 \
  --transition fade
```

---

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/video/images` | Lista imágenes subidas |
| `POST` | `/api/video/upload` | Sube una imagen |
| `DELETE` | `/api/video/images/:filename` | Elimina una imagen |
| `POST` | `/api/video/generate` | Lanza síntesis de vídeo |
| `GET` | `/api/video/status` | Estado del job en curso |
| `GET` | `/api/video/download` | Info del vídeo generado |
| `GET` | `/api/video/file/:filename` | Descarga el archivo MP4 |

---

## Paleta de colores

```css
--neon-red:    hsl(347 100% 50%)   /* #FF003C */
--neon-cyan:   hsl(172 100% 47%)   /* #00F5D4 */
--neon-yellow: hsl(52  100% 50%)   /* #FFE600 */
--background:  hsl(240  40%  4%)   /* #070714 */
```

---

## Desarrolladoras

| | Usuario | Rol |
|---|---------|-----|
| 👾 | [@aariidev](https://github.com/aariidev) | Lead Developer |
| 🤖 | Replit Agent | AI Pair Programmer |

---

## Licencia

MIT © 2077 — Night City Tech Division
