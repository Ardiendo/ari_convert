from moviepy import ImageSequenceClip
import os
import re

image_extensions = ('.png', '.jpg', '.jpeg', '.webp', '.bmp')

frames = sorted(
    [f for f in os.listdir('.') if f.lower().endswith(image_extensions)],
    key=lambda x: [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', x)]
)

if not frames:
    print("No se encontraron imágenes en el directorio actual.")
else:
    print(f"Imágenes detectadas ({len(frames)}): {frames}")
    clip = ImageSequenceClip(frames, fps=120)
    clip.write_videofile("video_final.mp4", codec="libx264", fps=120)
    print("Video generado: video_final.mp4")
