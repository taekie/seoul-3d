# 해안선 주변(바다색 경계에서 ±6px)만 골라 변한 픽셀을 센다. 숲의 나무 흔들림은 제외된다.
import numpy as np
from PIL import Image, ImageFilter
a = np.asarray(Image.open('flick-a.png').convert('RGB')).astype(int)
b = np.asarray(Image.open('flick-b.png').convert('RGB')).astype(int)
sea = (np.abs(a - np.array([43,167,216])).sum(2) < 60).astype(np.uint8) * 255
im = Image.fromarray(sea)
grow = np.asarray(im.filter(ImageFilter.MaxFilter(13))) > 127
shrink = np.asarray(im.filter(ImageFilter.MinFilter(13))) > 127
band = grow & ~shrink
ch = (np.abs(a-b).sum(2) > 28)
print(f"해안대 {band.sum():>7}px  변한 픽셀 {(ch&band).sum():>6}  비율 {100*(ch&band).sum()/max(band.sum(),1):.2f}%   (전체 변화 {ch.sum()})")
