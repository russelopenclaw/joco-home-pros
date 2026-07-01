#!/usr/bin/env python3
"""Generate OG image for JoCo Home Pros using Pillow."""
from PIL import Image, ImageDraw, ImageFont
import os

WIDTH, HEIGHT = 1200, 630

img = Image.new("RGB", (WIDTH, HEIGHT), "#1e3a5f")
draw = ImageDraw.Draw(img)

# Gradient overlay (lighter at center)
for y in range(HEIGHT):
    alpha = int(40 + (y / HEIGHT) * 30)
    draw.line([(0, y), (WIDTH, y)], fill=(30, 58, 95 + alpha))

# Draw accent bar at top
draw.rectangle([(0, 0), (WIDTH, 8)], fill="#2563eb")

# House icon (simple)
house_x, house_y = 600, 180
# Roof
draw.polygon([(house_x - 40, house_y + 30), (house_x, house_y - 10), (house_x + 40, house_y + 30)], fill="#ffffff", outline="#ffffff")
# Body
draw.rectangle([(house_x - 30, house_y + 30), (house_x + 30, house_y + 70)], fill="#ffffff", outline="#ffffff")
# Door
draw.rectangle([(house_x - 8, house_y + 45), (house_x + 8, house_y + 70)], fill="#1e3a5f")
# Window
draw.rectangle([(house_x - 20, house_y + 35), (house_x - 8, house_y + 45)], fill="#2563eb")
draw.rectangle([(house_x + 8, house_y + 35), (house_x + 20, house_y + 45)], fill="#2563eb")

# Title
try:
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
    sub_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    tag_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
except:
    title_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()
    tag_font = ImageFont.load_default()

# Title text
draw.text((WIDTH // 2, 310), "JoCo Home Pros", fill="white", font=title_font, anchor="mm")

# Subtitle
draw.text((WIDTH // 2, 390), "Trusted Home Services in Johnson County, KS", fill="#93c5fd", font=sub_font, anchor="mm")

# Tagline
draw.text((WIDTH // 2, 450), "HVAC  •  Plumbing  •  Roofing  •  Landscaping  •  Electrician  •  More", fill="#d1d5db", font=tag_font, anchor="mm")

# Bottom accent
draw.rectangle([(0, HEIGHT - 8), (WIDTH, HEIGHT)], fill="#2563eb")

output_path = os.path.join(os.path.dirname(__file__), "..", "public", "og-image.png")
img.save(output_path, "PNG", quality=95)
print(f"Saved to {output_path} ({os.path.getsize(output_path)} bytes)")