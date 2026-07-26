"""Fatia as composicoes de estandartes (#97) em um asset por linguagem.

Ferramenta de conteudo, roda a mao — nao entra no build nem na CI.

    pip install pillow numpy scipy
    python scripts/slice-banners.py public/banners 640 80

As composicoes de origem (`ref1.png`, `ref2.png`, `ref3.png`) NAO sao versionadas
— sao os anexos da issue #97, com ~2,5 MB cada. Baixe-as para o diretorio de
trabalho antes de rodar:

    ref1 -> https://github.com/user-attachments/assets/d8f1ce62-3b96-496e-8d80-7cb4976ea51a
    ref2 -> https://github.com/user-attachments/assets/2815635c-e653-47a5-a343-218215f943a3
    ref3 -> https://github.com/user-attachments/assets/b645adf0-13b8-4da8-ab9a-d38180a7d084

Sobre o recorte: o fundo NAO e removido para alpha. Tentativas por luminancia
(flood do escuro conectado a borda) e por silhueta (preencher o contorno da
moldura dourada) falharam nos estandartes de veludo escuro — PHP, C#, C++, SQL,
Ruby tem tecido tao escuro quanto o fundo, e o recorte comia o pano deixando so
os detalhes dourados. Como a UI e quase preta, o proprio fundo da arte se
confunde com ela; o recorte retangular preserva a arte intacta e e robusto.

Ordem dos nomes = ordem dos estandartes da esquerda para a direita em cada
composicao. Ao adicionar uma linguagem nova, acrescente o id em LANGUAGES
(`src/lib/languages.ts`) e gere o asset correspondente aqui.
"""
import sys
import numpy as np
from scipy import ndimage
from PIL import Image

RATIO = 5.0  # altura / largura da celula final


def luminance(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    return 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]


def segment(lum):
    lab, _ = ndimage.label(lum < 34, structure=np.ones((3, 3)))
    edge = set(lab[:, 0]) | set(lab[:, -1]) | set(lab[-1, :])
    edge.discard(0)
    has = (~np.isin(lab, list(edge))).max(axis=0)
    runs, start = [], None
    for x, v in enumerate(has):
        if v and start is None:
            start = x
        elif not v and start is not None:
            if x - start >= 40:
                runs.append((start, x))
            start = None
    if start is not None and len(has) - start >= 40:
        runs.append((start, len(has)))
    return runs


def rows_with_content(lum, x0, x1):
    lab, _ = ndimage.label(lum < 34, structure=np.ones((3, 3)))
    edge = set(lab[:, 0]) | set(lab[:, -1]) | set(lab[-1, :])
    edge.discard(0)
    opaque = ~np.isin(lab, list(edge))
    rows = np.where(opaque[:, x0:x1].max(axis=1))[0]
    return (int(rows[0]), int(rows[-1] + 1)) if len(rows) else (0, lum.shape[0])


def main(path, names, out_dir, target_h, quality):
    im = Image.open(path).convert("RGB")
    lum = luminance(im)
    runs = segment(lum)
    print(f"{path}: {len(runs)} estandartes (esperado {len(names)})")
    if len(runs) != len(names):
        sys.exit("ABORTA: contagem divergente")

    bg = tuple(np.asarray(im).reshape(-1, 3)[np.argsort(luminance(im).ravel())[: 5000]].mean(0).astype(int))
    tw = round(target_h / RATIO)
    for (x0, x1), name in zip(runs, names):
        y0, y1 = rows_with_content(lum, x0, x1)
        cell = im.crop((x0, y0, x1, y1))
        # Escala pela ALTURA e centraliza numa celula de razao fixa: o carousel
        # fica com itens identicos e cada estandarte mantem sua proporcao.
        w = round(cell.width * target_h / cell.height)
        cell = cell.resize((w, target_h), Image.LANCZOS)
        canvas = Image.new("RGB", (tw, target_h), bg)
        canvas.paste(cell, ((tw - w) // 2, 0))
        canvas.save(f"{out_dir}/{name}.webp", "WEBP", quality=quality, method=6)
    print(f"  -> {len(names)} arquivos {tw}x{target_h} (fundo {bg})")


if __name__ == "__main__":
    REF2 = ["typescript", "bash", "sql", "ruby", "lua", "dart", "scala", "elixir", "erlang", "haskell"]
    REF3 = ["python", "javascript", "cpp", "java", "csharp", "php", "rust", "go", "swift", "kotlin"]
    REF1 = ["julia", "clojure", "fortran", "cobol", "c"]
    out_dir, target_h, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    main("ref1.png", REF1, out_dir, target_h, q)
    main("ref2.png", REF2, out_dir, target_h, q)
    main("ref3.png", REF3, out_dir, target_h, q)
