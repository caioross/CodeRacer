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

RECORTE POR SCANLINE (o alpha e essencial: os estandartes ficam suspensos sobre
o fundo da aplicacao, sem moldura). Duas abordagens obvias falham e vale
registrar por que, para ninguem repeti-las:

  * flood do fundo escuro conectado as bordas: o veludo de PHP, C#, C++, SQL e
    Ruby tem luminancia ~9-16, igual ao fundo — o flood entra pelo topo (os
    estandartes encostam na borda da composicao) e come o tecido, sobrando so os
    detalhes dourados;
  * preencher o contorno da moldura: o fio dourado se interrompe em varios
    pontos e o preenchimento vaza (Python ficou com 12% de cobertura).

O scanline resolve porque so precisa do limite EXTERNO: varre cada linha de fora
para dentro ate achar o primeiro pixel claro (a moldura, que salta para 46-148
contra um fundo de ~9-16) e preenche entre os dois limites. O interior escuro
nunca e visitado, entao nao ha o que comer. A ponta em V e a franja saem de
graca: nas linhas de baixo os dois limites convergem.
"""
import sys
import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter

RATIO = 5.0  # altura / largura da celula final
EDGE = 40  # luminancia que marca a moldura do estandarte
SEG = 34  # luminancia de fundo, para separar as colunas


def luminance(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    return 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]


def segment(lum):
    """Limites de coluna de cada estandarte na composicao."""
    lab, _ = ndimage.label(lum < SEG, structure=np.ones((3, 3)))
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


def scanline_alpha(cell_lum):
    """Alpha do estandarte: preenche entre a primeira e a ultima coluna clara.

    Linhas SEM nenhum pixel claro ficam transparentes — e o que corta a ponta em
    V e o que sobra acima/abaixo. Nao suavize os limites usando essas linhas
    vazias como se fossem borda em zero: perto da base a maioria das linhas e
    vazia, e a media puxaria o limite para a coluna 0, preenchendo a largura
    inteira exatamente onde o V deveria afunilar.
    """
    h, w = cell_lum.shape
    bright = cell_lum > EDGE
    mask = np.zeros((h, w), bool)
    for y in range(h):
        xs = np.flatnonzero(bright[y])
        if xs.size:
            mask[y, xs[0] : xs[-1] + 1] = True
    # Fecha frestas de 1-2 linhas onde a moldura escurece abaixo do limiar, sem
    # deslocar a silhueta (fechamento so na vertical).
    return (ndimage.binary_closing(mask, structure=np.ones((5, 1))) * 255).astype(np.uint8)


def main(path, names, out_dir, target_h, quality):
    im = Image.open(path).convert("RGB")
    lum = luminance(im)
    runs = segment(lum)
    print(f"{path}: {len(runs)} estandartes (esperado {len(names)})")
    if len(runs) != len(names):
        sys.exit("ABORTA: contagem divergente")

    tw = round(target_h / RATIO)
    for (x0, x1), name in zip(runs, names):
        a0, a1 = max(0, x0 - 3), min(im.width, x1 + 3)
        cell = im.crop((a0, 0, a1, im.height)).convert("RGBA")
        alpha = scanline_alpha(lum[:, a0:a1])
        cell.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.6)))
        bbox = cell.split()[3].getbbox()
        cell = cell.crop(bbox)
        # Escala pela ALTURA e centraliza numa celula de razao fixa: o carousel
        # fica com itens identicos e cada estandarte mantem sua proporcao.
        w = round(cell.width * target_h / cell.height)
        cell = cell.resize((w, target_h), Image.LANCZOS)
        canvas = Image.new("RGBA", (tw, target_h), (0, 0, 0, 0))
        canvas.paste(cell, ((tw - w) // 2, 0), cell)
        canvas.save(f"{out_dir}/{name}.webp", "WEBP", quality=quality, method=6)
        cover = np.asarray(canvas.split()[3]).mean() / 255
        print(f"  {name:12s} -> {tw}x{target_h}  cobertura={cover:.0%}")


if __name__ == "__main__":
    REF1 = ["julia", "clojure", "fortran", "cobol", "c"]
    REF2 = ["typescript", "bash", "sql", "ruby", "lua", "dart", "scala", "elixir", "erlang", "haskell"]
    REF3 = ["python", "javascript", "cpp", "java", "csharp", "php", "rust", "go", "swift", "kotlin"]
    out_dir, target_h, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    main("ref1.png", REF1, out_dir, target_h, q)
    main("ref2.png", REF2, out_dir, target_h, q)
    main("ref3.png", REF3, out_dir, target_h, q)
