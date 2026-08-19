#!/usr/bin/env python3
"""
Extract base64 inline images from index.html, deduplicate, convert to WebP
with mobile variants, and replace inline data: URIs with:
- <picture>/<img> for <img src="data:...">
- url('extracted/X.webp') for style="background-image:url('data:...')"
"""
import base64
import hashlib
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "index.html"
OUT_DIR = ROOT / "images" / "extracted"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Order-based naming for image occurrences
DEAL_NAMES = {
    1: "city-gate-friedrichstrasse",
    2: "muellerstrasse-berlin",
    3: "moninger-hof",
    4: "eterna-park",
    5: "ayverdis-bahnhofplatz",
    6: "zeppelin-carre-stuttgart",
}
TEAM_NAMES = {7: "team-quote-1", 8: "team-quote-2", 9: "team-quote-3"}
# #10-13 are landmark-card backgrounds (duplicates of deal images by hash, but we slug them separately)
LANDMARK_NAMES = {10: "landmark-eterna", 11: "landmark-moninger",
                  12: "landmark-extra", 13: "landmark-muellerstrasse"}
PARTNER_NAMES = {
    14: "partner-radisson-hero", 15: "partner-dunman-capital",
    16: "partner-bobw", 17: "partner-limehome", 18: "partner-herecon",
    19: "partner-mcdreams", 20: "partner-vorreiter", 21: "partner-myspa",
    22: "partner-radisson-logo", 23: "partner-currily", 24: "partner-lbbw",
}

def slug_for(idx):
    return (DEAL_NAMES.get(idx) or TEAM_NAMES.get(idx)
            or LANDMARK_NAMES.get(idx) or PARTNER_NAMES.get(idx)
            or f"image-{idx}")

def needs_mobile_variant(idx):
    return idx in DEAL_NAMES or idx in LANDMARK_NAMES

def is_logo(idx):
    return idx in PARTNER_NAMES or idx in TEAM_NAMES

def main():
    html = HTML_PATH.read_text()
    pattern = re.compile(r'data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)', re.DOTALL)
    matches = list(pattern.finditer(html))
    print(f"Found {len(matches)} inline base64 images")

    # Dedupe by hash
    by_hash = {}
    img_meta = []
    for i, m in enumerate(matches, start=1):
        ext = m.group(1).replace("jpeg", "jpg")
        b64 = m.group(2)
        h = hashlib.md5(b64.encode()).hexdigest()[:10]
        if h not in by_hash:
            slug = slug_for(i)
            data = base64.b64decode(b64)
            raw_path = OUT_DIR / f"{slug}.{ext}"
            raw_path.write_bytes(data)
            by_hash[h] = {"slug": slug, "ext": ext, "raw": raw_path, "owner_idx": i}
        img_meta.append({"idx": i, "hash": h})

    print(f"Unique images: {len(by_hash)}")

    # Convert each unique image
    for h, info in by_hash.items():
        slug = info["slug"]
        raw = info["raw"]
        owner = info["owner_idx"]
        webp_full = OUT_DIR / f"{slug}.webp"
        q = "82" if needs_mobile_variant(owner) else ("90" if is_logo(owner) else "85")
        subprocess.run(["cwebp", "-q", q, "-quiet", str(raw), "-o", str(webp_full)], check=True)
        info["webp"] = webp_full
        info["webp_800"] = None
        info["jpg_fallback"] = None
        if needs_mobile_variant(owner):
            webp_800 = OUT_DIR / f"{slug}-800.webp"
            subprocess.run(
                ["magick", str(raw), "-resize", "800x>", "-quality", "82",
                 "-define", "webp:method=6", str(webp_800)],
                check=True,
            )
            info["webp_800"] = webp_800
            if info["ext"] == "png":
                jpg_fb = OUT_DIR / f"{slug}.jpg"
                subprocess.run(
                    ["magick", str(raw), "-quality", "85", "-background", "white",
                     "-flatten", str(jpg_fb)],
                    check=True,
                )
                info["jpg_fallback"] = jpg_fb

    # Build replacements: iterate matches in REVERSE so offsets stay stable
    new_html = html
    matches_now = list(pattern.finditer(new_html))
    for rev_idx, m in enumerate(reversed(matches_now), start=1):
        idx = len(matches_now) - rev_idx + 1
        info = by_hash[img_meta[idx - 1]["hash"]]
        slug = info["slug"]
        owner = info["owner_idx"]
        webp_rel = f"images/extracted/{slug}.webp"
        jpg_rel = (f"images/extracted/{slug}.jpg" if info["jpg_fallback"]
                   else f"images/extracted/{slug}.{info['ext']}")
        webp_800_rel = f"images/extracted/{slug}-800.webp" if info["webp_800"] else None

        # Determine context: is this inside an <img src="..."> or a style="background-image:url('...')"?
        # Look ~150 chars before for clues
        pre = new_html[max(0, m.start()-150):m.start()]

        if "<img " in pre and "src=" in pre.rsplit("<img ", 1)[-1] and "url(" not in pre.rsplit("<img ", 1)[-1]:
            # CASE 1: <img src="data:..."> — replace the entire <img ...> tag
            start = new_html.rfind("<img", 0, m.start())
            end = new_html.find(">", m.end()) + 1
            original_tag = new_html[start:end]
            # Parse attributes (skip src= which we replace)
            attrs = {}
            for am in re.finditer(r'(\w+)="([^"]*)"', original_tag):
                k, v = am.group(1), am.group(2)
                if k == "src":
                    continue
                attrs[k] = v
            alt = attrs.pop("alt", "")
            cls = attrs.pop("class", "")
            # Don't double up loading attribute
            has_loading = "loading" in attrs
            extra_attrs_parts = [f'{k}="{v}"' for k, v in attrs.items()]
            if not has_loading:
                extra_attrs_parts.append('loading="lazy"')
            extra_attrs_parts.append('decoding="async"')
            extra = " ".join(extra_attrs_parts)
            cls_attr = f' class="{cls}"' if cls else ''
            alt_attr = f' alt="{alt}"' if alt else ' alt=""'

            if needs_mobile_variant(owner) and webp_800_rel:
                replacement = (
                    f'<picture>'
                    f'<source srcset="{webp_800_rel} 800w, {webp_rel} 1600w" '
                    f'sizes="(max-width: 768px) 100vw, 800px" type="image/webp">'
                    f'<img src="{jpg_rel}"{alt_attr}{cls_attr} {extra}>'
                    f'</picture>'
                )
            else:
                replacement = f'<img src="{webp_rel}"{alt_attr}{cls_attr} {extra}>'
            new_html = new_html[:start] + replacement + new_html[end:]
        else:
            # CASE 2: style="background-image:url('data:...')" — replace only the data: URI
            new_html = new_html[:m.start()] + webp_rel + new_html[m.end():]

    HTML_PATH.write_text(new_html)
    print(f"HTML new size: {HTML_PATH.stat().st_size // 1024} KB")

if __name__ == "__main__":
    main()
