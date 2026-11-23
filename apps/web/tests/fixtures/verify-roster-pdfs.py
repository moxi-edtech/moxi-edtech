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
logo_square = directory / "lista_sintetica_logo_quadrado.pdf"
logo_wide = directory / "lista_sintetica_logo_horizontal.pdf"
logo_tall = directory / "lista_sintetica_logo_vertical.pdf"
logo_files = (logo_square, logo_wide, logo_tall)
all_files = (large, sensitive, empty, lacunas, *logo_files)
for file in all_files:
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

for file in all_files:
    text = output("pdftotext", "-layout", str(file), "-")
    assert "LISTA NOMINAL DE ALUNOS" in text, file.name
    assert "Ano letivo: 2025/2026" in text, file.name
    assert "Modo:" in text, file.name
    assert "Página 1 de" in text, file.name
    assert "Assinatura da Direcção" in text, file.name
    assert "Gerado pelo KLASSE | Sistema de Gestão Escolar Inteligente | www.klasse.ao" in text, file.name
    expected_school = "IDENTIDADE ESCOLAR FICTICIA" if file in logo_files else "INSTITUTO FICTÍCIO DE TESTES"
    assert expected_school in re.sub(r"\\s+", " ", text), file.name
    if file == empty:
        assert "Sem alunos matriculados neste período" in text
        assert "Total de alunos: 0" in text
    elif file == lacunas:
        assert "Total de alunos: 61" in text
        assert re.search(r"(?m)^\s*61\s+P-0061\b", text), "A última linha deve ser Nº 61"
        assert not re.search(r"(?m)^\s*74\s+P-0061\b", text), "Número de chamada não é Nº da lista"
    elif file in logo_files:
        assert "Total de alunos: 5" in text
        assert "P-0001" in text and "P-0005" in text
    else:
        assert "Total de alunos: 55" in text
        assert "P-0001" in text and "P-0055" in text
        assert "Pessoa Simulada de Nome Repetido" in text
        assert "Conceição" in text and "Acentuação" in text
    for page_no in range(1, pages(file) + 1):
        single_page = output("pdftotext", "-f", str(page_no), "-l", str(page_no), str(file), "-")
        assert expected_school in re.sub(r"\\s+", " ", single_page), (file.name, page_no, "header")
        assert "Gerado pelo KLASSE | Sistema de Gestão Escolar Inteligente | www.klasse.ao" in single_page, (file.name, page_no, "brand")
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
        if file in logo_files:
            words = page_el.findall(".//x:word", ns)
            school_word = next((w for w in words if w.text == "IDENTIDADE"), None)
            title_word = next((w for w in words if w.text == "LISTA"), None)
            assert school_word is not None and title_word is not None, (file.name, "header words")
            title_top = float(title_word.attrib["yMin"])
            school_top = float(school_word.attrib["yMin"])
            school_bottom = max(
                float(w.attrib["yMax"]) for w in words if float(w.attrib["yMin"]) < title_top
            )
            assert school_top >= 20 and title_top - school_bottom >= 12, (
                file.name, "header spacing", school_top, school_bottom, title_top
            )
            if file != logo_wide:  # cabeçalho de uma linha: centro do nome e do logótipo
                school_center = (school_top + float(school_word.attrib["yMax"])) / 2
                assert abs(school_center - 55) <= 10, (file.name, "vertical alignment", school_center)
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


# O relatório geral tem o MESMO cabeçalho, rodapé, assinatura e paginação.
# As colunas próprias devem ser preservadas, com acentuação e situação da bolsa.
geral = directory / "lista_alunos_geral_sintetica_55.pdf"
geral_vazio = directory / "lista_alunos_geral_sintetica_vazia.pdf"
for file in (geral, geral_vazio):
    assert file.exists() and file.stat().st_size > 1000, file.name
    info = output("pdfinfo", str(file))
    assert re.search(r"^Pages:\s+[1-9]", info, re.M), file.name
    assert "Page size:       841" in info or "841.89" in info, (file.name, "A4 horizontal")
    text = output("pdftotext", "-layout", str(file), "-")
    for fragment in [
        "LISTA DE ALUNOS",
        "IDENTIDADE ESCOLAR FICTICIA",
        "Ano letivo: 2025/2026",
        "Bolsa: Todos",
        "Classe: Todas",
        "Turno: Todos",
        "Nome completo",
        "Responsável",
        "Telefone",
        "Turma",
        "Classe",
        "Bolsa",
        "Assinatura da Direcção",
        "Gerado pelo KLASSE | Sistema de Gestão Escolar Inteligente | www.klasse.ao",
        "Página 1 de",
    ]:
        assert fragment in text, (file.name, fragment)
    for page_no in range(1, pages(file) + 1):
        page_text = output("pdftotext", "-f", str(page_no), "-l", str(page_no), str(file), "-")
        assert "IDENTIDADE ESCOLAR FICTICIA" in page_text, (file.name, "header", page_no)
        assert "Gerado pelo KLASSE" in page_text, (file.name, "footer", page_no)
        assert "Página " + str(page_no) + " de " in page_text, (file.name, "pagination", page_no)

    # Verificar as margens reais de cada palavra no PDF gerado.
    root = ET.fromstring(output("pdftotext", "-bbox", str(file), "-"))
    ns = {"x": "http://www.w3.org/1999/xhtml"}
    for page_el in root.findall(".//x:page", ns):
        w, h = float(page_el.attrib["width"]), float(page_el.attrib["height"])
        for word in page_el.findall(".//x:word", ns):
            x1, x2 = float(word.attrib["xMin"]), float(word.attrib["xMax"])
            y1, y2 = float(word.attrib["yMin"]), float(word.attrib["yMax"])
            assert x1 >= 16 and x2 <= w - 16, (file.name, word.text, "x", x1, x2, w)
            assert y1 >= 14 and y2 <= h - 14, (file.name, word.text, "y", y1, y2, h)

    if file == geral:
        assert pages(file) >= 2
        assert "Total de alunos: 55" in text
        assert "Pessoa Simulada de Nome Repetido" in text
        assert "Conceição" in text
        assert re.search(r"(?m)^\s*55\s+P-0055\b", text), "Último aluno deve ser 55"
        assert re.search(r"\bSim\b", text) and re.search(r"\bNão\b", text)
    else:
        assert "Nenhum aluno corresponde aos filtros selecionados" in text
        assert "Total de alunos: 0" in text

    subprocess.check_call([
        "pdftoppm", "-f", "1", "-l", str(min(3, pages(file))),
        "-png", "-scale-to", "1024", str(file),
        str(directory / file.stem)
    ], stdout=subprocess.DEVNULL)

print(f"PDFs sintéticos validados: {large_pages} páginas para 55 alunos; lista geral institucional e margens OK")
