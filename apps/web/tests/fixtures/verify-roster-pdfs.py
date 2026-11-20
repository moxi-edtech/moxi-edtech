#!/usr/bin/env python3
"""Validação de saída REAL: PDFs sintéticos, texto, paginação e margens."""
from __future__ import annotations
from pathlib import Path
import subprocess
import sys
import re
import xml.etree.ElementTree as ET

directory = Path(sys.argv[1]).resolve()
large = directory / "lista_sintetica_55.pdf"
sensitive = directory / "lista_sintetica_55_sensivel.pdf"
empty = directory / "lista_sintetica_vazia.pdf"
lacunas = directory / "lista_sintetica_61_lacunas.pdf"
for file in (large, sensitive, empty, lacunas):
    assert file.exists() and file.stat().st_size > 1000, f"PDF vazio ou ausente: {file.name}"

def output(*args: str) -> str:
    return subprocess.check_output(args, encoding="utf-8", errors="replace")

def pages(file: Path) -> int:
    metadata = output("pdfinfo", str(file))
    match = re.search(r"^Pages:\s+(\d+)\s*$", metadata, re.M)
    assert match, metadata
    return int(match.group(1))

large_pages = pages(large)
assert large_pages >= 2, f"Lista de 55 alunos exige paginação: {large_pages}"
assert pages(empty) >= 1

for file in (large, sensitive, empty, lacunas):
    text = output("pdftotext", "-layout", str(file), "-")
    assert "LISTA NOMINAL DE ALUNOS" in text, file.name
    assert "Ano letivo: 2025/2026" in text, file.name
    assert "Modo:" in text, file.name
    assert "Página 1 de" in text, file.name
    assert "Assinatura da Direcção" in text, file.name
    assert "Gerado pelo KLASSE | app.klasse.ao" in text, file.name
    assert "INSTITUTO FICTÍCIO DE TESTES" in text, file.name
    if file == empty:
        assert "Sem alunos matriculados neste período" in text
        assert "Total de alunos: 0" in text
    elif file == lacunas:
        assert "Total de alunos: 61" in text
        assert re.search(r"(?m)^\s*61\s+P-0061\b", text), "A última linha deve ser Nº 61"
        assert not re.search(r"(?m)^\s*74\s+P-0061\b", text), "Número de chamada não é Nº da lista"
    else:
        assert "Total de alunos: 55" in text
        assert "P-0001" in text and "P-0055" in text
        assert "Pessoa Simulada de Nome Repetido" in text
        assert "Conceição" in text and "Acentuação" in text
        for page_no in range(1, pages(file) + 1):
            single_page = output("pdftotext", "-f", str(page_no), "-l", str(page_no), str(file), "-")
            assert "INSTITUTO FICTÍCIO DE TESTES" in single_page, (file.name, page_no, "header")
            assert "Gerado pelo KLASSE" in single_page, (file.name, page_no, "brand")
            assert "Página " + str(page_no) + " de " in single_page, (file.name, page_no, "footer")
    if file == sensitive:
        assert "INFORMAÇÃO SENSÍVEL" in text and "BI-TESTE" in text
    else:
        assert "BI-TESTE" not in text

    # BBoxes reflect final laid-out PDF text, not an estimate of font width.
    bbox = subprocess.check_output(["pdftotext", "-bbox", str(file), "-"], text=True)
    root = ET.fromstring(bbox)
    ns = {"x": "http://www.w3.org/1999/xhtml"}
    count = 0
    for page_el in root.findall(".//x:page", ns):
        w = float(page_el.attrib["width"])
        h = float(page_el.attrib["height"])
        for word in page_el.findall(".//x:word", ns):
            count += 1
            x1, x2 = float(word.attrib["xMin"]), float(word.attrib["xMax"])
            y1, y2 = float(word.attrib["yMin"]), float(word.attrib["yMax"])
            assert x1 >= 16 and x2 <= w - 16, (
                file.name, word.text, "x", x1, x2, w
            )
            assert y1 >= 14 and y2 <= h - 14, (
                file.name, word.text, "y", y1, y2, h
            )
    assert count > 20, f"PDF sem texto analisável: {file.name}"

    # Renderizar fisicamente páginas em PNG como evidência anexável ao PR.
    subprocess.check_call([
        "pdftoppm", "-f", "1", "-l", str(min(3, pages(file))),
        "-png", "-scale-to", "1024", str(file),
        str(directory / file.stem)
    ], stdout=subprocess.DEVNULL)

print(f"PDFs sintéticos validados: {large_pages} páginas para 55 alunos; limites e margens OK")
