import os
try:
    from PIL import Image
    im = Image.open("../frontend/public/logo.png")
    print("Format:", im.format, "Size:", im.size, "Mode:", im.mode)
    # Get dominant colors
    im_resized = im.resize((150, 150))
    colors = im_resized.getcolors(150*150)
    if colors:
        sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)
        print("Top 10 dominant colors (count, color):")
        for count, color in sorted_colors[:10]:
            print(count, color)
except Exception as e:
    print("Error:", e)
