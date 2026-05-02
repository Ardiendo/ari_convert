from moviepy import ImageClip, concatenate_videoclips, AudioFileClip, CompositeVideoClip
from moviepy import vfx
import os
import re
import argparse
import sys
from PIL import Image

# ─────────────────────────────────────────
#  CONFIGURACIÓN POR DEFECTO
# ─────────────────────────────────────────
DEFAULT_FPS          = 30
DEFAULT_DURATION     = 2.0      # segundos por imagen
DEFAULT_OUTPUT       = "video_final.mp4"
DEFAULT_TRANSITION   = "none"   # "none" | "fade" | "crossfade"
DEFAULT_TRANSITION_T = 0.5      # duración de la transición en segundos
DEFAULT_CODEC        = "libx264"
DEFAULT_RESIZE       = None     # ej. "1920x1080" o None para no redimensionar

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff')


# ─────────────────────────────────────────
#  UTILIDADES
# ─────────────────────────────────────────
def natural_sort_key(text):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', text)]


def find_images(folder, recursive=False):
    images = []
    if recursive:
        for root, _, files in os.walk(folder):
            for f in files:
                if f.lower().endswith(IMAGE_EXTENSIONS):
                    images.append(os.path.join(root, f))
    else:
        images = [
            os.path.join(folder, f)
            for f in os.listdir(folder)
            if f.lower().endswith(IMAGE_EXTENSIONS)
        ]
    return images


def sort_images(images, method):
    if method == "name":
        return sorted(images, key=lambda x: natural_sort_key(os.path.basename(x)))
    elif method == "date":
        return sorted(images, key=lambda x: os.path.getmtime(x))
    elif method == "date_desc":
        return sorted(images, key=lambda x: os.path.getmtime(x), reverse=True)
    return images


def resize_image(path, size):
    """Redimensiona una imagen y devuelve la ruta a un archivo temporal."""
    w, h = size
    tmp_path = path + "_resized.jpg"
    img = Image.open(path).convert("RGB")
    img = img.resize((w, h), Image.LANCZOS)
    img.save(tmp_path, quality=95)
    return tmp_path


def get_common_size(image_paths, target):
    if target:
        w, h = map(int, target.split('x'))
        return (w, h)
    # usa el tamaño de la primera imagen como referencia
    img = Image.open(image_paths[0])
    return img.size


def cleanup_temp(paths):
    for p in paths:
        if p.endswith("_resized.jpg") and os.path.exists(p):
            os.remove(p)


# ─────────────────────────────────────────
#  CONSTRUCCIÓN DEL VIDEO
# ─────────────────────────────────────────
def build_clips(image_paths, duration, fps, transition, transition_t, size):
    clips = []
    temp_files = []
    common_size = get_common_size(image_paths, size)

    for i, path in enumerate(image_paths):
        # redimensionar si hace falta
        img = Image.open(path)
        if img.size != common_size:
            path = resize_image(path, common_size)
            temp_files.append(path)

        clip = ImageClip(path).with_duration(duration)

        if transition == "fade":
            clip = clip.with_effects([vfx.FadeIn(transition_t), vfx.FadeOut(transition_t)])
        elif transition == "crossfade" and i > 0:
            clip = clip.with_effects([vfx.CrossFadeIn(transition_t)])

        clips.append(clip)

    return clips, temp_files


def build_video(clips, transition, transition_t, fps):
    if transition == "crossfade":
        final = concatenate_videoclips(clips, padding=-transition_t, method="compose")
    else:
        final = concatenate_videoclips(clips, method="compose")
    return final


# ─────────────────────────────────────────
#  PROGRAMA PRINCIPAL
# ─────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Convierte imágenes en un video MP4.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "--folder", "-f", default=".",
        help="Carpeta donde buscar imágenes (default: directorio actual)"
    )
    parser.add_argument(
        "--recursive", "-r", action="store_true",
        help="Buscar imágenes en subcarpetas también"
    )
    parser.add_argument(
        "--sort", "-s", default="name",
        choices=["name", "date", "date_desc"],
        help="Orden de las imágenes: name | date | date_desc (default: name)"
    )
    parser.add_argument(
        "--duration", "-d", type=float, default=DEFAULT_DURATION,
        help=f"Segundos que se muestra cada imagen (default: {DEFAULT_DURATION})"
    )
    parser.add_argument(
        "--fps", type=int, default=DEFAULT_FPS,
        help=f"Frames por segundo del video (default: {DEFAULT_FPS})"
    )
    parser.add_argument(
        "--transition", "-t", default=DEFAULT_TRANSITION,
        choices=["none", "fade", "crossfade"],
        help="Tipo de transición: none | fade | crossfade (default: none)"
    )
    parser.add_argument(
        "--transition-time", type=float, default=DEFAULT_TRANSITION_T,
        help=f"Duración de la transición en segundos (default: {DEFAULT_TRANSITION_T})"
    )
    parser.add_argument(
        "--resize", default=DEFAULT_RESIZE,
        help="Resolución de salida en formato WxH, ej: 1920x1080 (default: tamaño original)"
    )
    parser.add_argument(
        "--audio", "-a", default=None,
        help="Ruta a un archivo de audio para añadir al video (mp3, wav, etc.)"
    )
    parser.add_argument(
        "--output", "-o", default=DEFAULT_OUTPUT,
        help=f"Nombre del archivo de salida (default: {DEFAULT_OUTPUT})"
    )
    parser.add_argument(
        "--codec", default=DEFAULT_CODEC,
        help=f"Codec de video (default: {DEFAULT_CODEC})"
    )

    args = parser.parse_args()

    # ── Buscar imágenes ──────────────────
    print(f"\n📂  Buscando imágenes en: {os.path.abspath(args.folder)}")
    images = find_images(args.folder, args.recursive)
    images = sort_images(images, args.sort)

    if not images:
        print("❌  No se encontraron imágenes. Verifica la carpeta o los formatos soportados.")
        sys.exit(1)

    print(f"✅  {len(images)} imagen(es) encontrada(s):")
    for img in images:
        print(f"     · {os.path.basename(img)}")

    # ── Resumen de configuración ─────────
    total_duration = len(images) * args.duration
    print(f"\n⚙️   Configuración:")
    print(f"     FPS           : {args.fps}")
    print(f"     Duración/img  : {args.duration}s")
    print(f"     Duración total: {total_duration:.1f}s ({total_duration/60:.1f} min)")
    print(f"     Transición    : {args.transition}" + (f" ({args.transition_time}s)" if args.transition != "none" else ""))
    print(f"     Resolución    : {args.resize or 'original'}")
    print(f"     Audio         : {args.audio or 'ninguno'}")
    print(f"     Salida        : {args.output}")
    print()

    # ── Construir clips ──────────────────
    clips, temp_files = build_clips(
        images, args.duration, args.fps,
        args.transition, args.transition_time, args.resize
    )

    # ── Unir clips ───────────────────────
    video = build_video(clips, args.transition, args.transition_time, args.fps)

    # ── Añadir audio ─────────────────────
    if args.audio:
        if not os.path.exists(args.audio):
            print(f"⚠️   Archivo de audio no encontrado: {args.audio}. Se omitirá.")
        else:
            audio = AudioFileClip(args.audio)
            if audio.duration < video.duration:
                audio = audio.with_effects([vfx.AudioLoop(duration=video.duration)])
            else:
                audio = audio.subclipped(0, video.duration)
            video = video.with_audio(audio)
            print(f"🎵  Audio añadido: {args.audio}")

    # ── Exportar ─────────────────────────
    print("🎬  Generando video...")
    video.write_videofile(
        args.output,
        fps=args.fps,
        codec=args.codec,
        audio_codec="aac",
        logger="bar"
    )

    # ── Limpieza ─────────────────────────
    cleanup_temp(temp_files)

    size_mb = os.path.getsize(args.output) / (1024 * 1024)
    print(f"\n✅  Video guardado: {args.output} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
