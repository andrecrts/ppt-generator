"""
classifier.py
Uses the Claude API (claude-sonnet-4-6) to classify extracted PDF text
into a structured list of slides via tool_use for reliable JSON output.
"""

import anthropic
from dataclasses import dataclass, field
from typing import List

SYSTEM_PROMPT = """\
Eres un experto en crear presentaciones académicas universitarias para UPANA (Universidad Panamericana de Guatemala).

Recibirás texto extraído de un PDF de material de curso y debes estructurarlo en diapositivas de PowerPoint \
claras y fieles al contenido original.

════════════════════════════════════════
ESTRUCTURA OBLIGATORIA DE LA PRESENTACIÓN
════════════════════════════════════════

1. PORTADA — slide_type: "title"
   • `title`: nombre completo de la asignatura/curso.
     - Si se indica "Curso:" al inicio del mensaje, úsalo EXACTAMENTE tal como aparece.
     - Si no se indica, extrae el nombre de la asignatura del contenido del PDF.
     - NUNCA inventes un título temático; usa el nombre oficial de la materia.
   • `bullets`: [] (vacío)

2. CONTENIDOS DE LA CLASE — slide_type: "content"
   • `title`: "Contenidos de la Clase"
   • `bullets`: lista de los temas principales de la sesión (2–5 ítems, \
numerados "1.", "2.", etc.)

3. CUERPO DE LA PRESENTACIÓN
   • Usa "section_header" para marcar el inicio de cada tema principal \
(transición entre secciones grandes).
   • Usa "content" para las diapositivas con puntos de contenido.
   • Máximo 6 bullets por diapositiva; si hay más, divide en dos con el MISMO título.
   • FIDELIDAD AL ORIGINAL: conserva la redacción del PDF tanto como sea posible. \
Reformula sólo si el texto es excesivamente largo (>2 líneas por bullet).
   • Incluye citas de autores presentes en el texto (p. ej. "Bisquerra, 2003").
   • Incluye TODOS los contenidos del PDF, incluyendo:
       – Actividades de clase, trabajos grupales o en parejas
         (title: "Instrucciones – Trabajo Grupal" o similar)
       – Tareas o actividades para la próxima semana
         (title: "Tarea – Semana X" o similar)
       – Reflexiones o preguntas de discusión

4. CONCLUSIÓN — slide_type: "content"
   • `title`: "Conclusión"
   • `bullets`: 3–5 ideas clave que sintetizan el aprendizaje de la sesión.

5. CIERRE — slide_type: "title"
   • `title`: mismo nombre de la asignatura que en la portada.
   • `bullets`: [] (vacío)

════════════════════════════════════════
REGLAS DE FORMATO
════════════════════════════════════════
- Todo el contenido en español.
- Títulos de diapositivas: máximo 8 palabras, concisos y descriptivos.
- Bullets: ideas clave, no párrafos completos. Mantén la redacción original \
cuando sea posible.
- Formato de bullet uniforme dentro de cada diapositiva \
(no mezcles "•" con "1." en la misma diapositiva).
- Si el PDF incluye numeración (1-, 2-, 3-…) consérvala tal como aparece.
- Omite metadatos residuales aislados (fechas sueltas, nombre del docente suelto, etc.).
"""


@dataclass
class Slide:
    slide_type: str           # "title" | "section_header" | "content"
    title: str
    bullets: List[str] = field(default_factory=list)


_EDIT_TOOL_SCHEMA = {
    "name": "edit_slide",
    "description": "Devuelve la diapositiva modificada según la instrucción",
    "input_schema": {
        "type": "object",
        "properties": {
            "slide_type": {
                "type": "string",
                "enum": ["title", "section_header", "content"],
                "description": "Tipo de diapositiva (mantener igual a menos que la instrucción lo cambie)",
            },
            "title": {
                "type": "string",
                "description": "Título de la diapositiva",
            },
            "bullets": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de bullets. Vacío para title y section_header.",
            },
        },
        "required": ["slide_type", "title", "bullets"],
    },
}

_TOOL_SCHEMA = {
    "name": "create_presentation",
    "description": "Crea la estructura completa de diapositivas para la presentación",
    "input_schema": {
        "type": "object",
        "properties": {
            "slides": {
                "type": "array",
                "description": "Lista ordenada de diapositivas",
                "items": {
                    "type": "object",
                    "properties": {
                        "slide_type": {
                            "type": "string",
                            "enum": ["title", "section_header", "content"],
                            "description": "Tipo de diapositiva",
                        },
                        "title": {
                            "type": "string",
                            "description": "Título de la diapositiva (máximo 8 palabras)",
                        },
                        "bullets": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "Lista de puntos clave. "
                                "Vacío para section_header y title."
                            ),
                        },
                    },
                    "required": ["slide_type", "title", "bullets"],
                },
            }
        },
        "required": ["slides"],
    },
}


def classify_to_slides(pages_text: List[str], course_name: str = "") -> List[Slide]:
    """
    Send extracted page texts to Claude and get back a structured slide list.

    Args:
        pages_text:  List of page text strings (already cropped, no admin pages).
        course_name: Official course name extracted from the PDF (used for the
                     title slide).  If empty Claude will infer it from the text.

    Returns:
        List of Slide objects ready for slide_builder.
    """
    client = anthropic.Anthropic()

    # Join pages with a clear separator so Claude knows page boundaries
    combined = "\n\n---\n\n".join(
        f"[Página {i + 1}]\n{text}" for i, text in enumerate(pages_text)
    )

    # Prepend the course name hint so Claude uses it verbatim for the title slide
    hint = f"Curso: {course_name.strip()}\n\n" if course_name.strip() else ""

    user_content = (
        hint
        + "Analiza el siguiente contenido extraído de un PDF universitario "
        + "y crea la estructura de diapositivas:\n\n"
        + combined
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8096,
        system=SYSTEM_PROMPT,
        tools=[_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "create_presentation"},
        messages=[{"role": "user", "content": user_content}],
    )

    # Extract the tool_use result
    for block in response.content:
        if block.type == "tool_use" and block.name == "create_presentation":
            raw_slides = block.input.get("slides", [])
            return [
                Slide(
                    slide_type=s.get("slide_type", "content"),
                    title=s.get("title", ""),
                    bullets=s.get("bullets", []),
                )
                for s in raw_slides
            ]

    return []


def edit_single_slide(slide: Slide, instruction: str) -> Slide:
    """
    Use Claude to modify a single slide based on a natural-language instruction.

    Args:
        slide:       The slide to edit.
        instruction: User instruction, e.g. "Shorten the title" or "Add a bullet about X".

    Returns:
        A new Slide with the requested changes applied.
        Falls back to the original slide if Claude fails.
    """
    client = anthropic.Anthropic()

    bullets_text = (
        "\n".join(f"- {b}" for b in slide.bullets) if slide.bullets else "(sin bullets)"
    )
    current_desc = (
        f"slide_type: {slide.slide_type}\n"
        f"title: {slide.title}\n"
        f"bullets:\n{bullets_text}"
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=(
            "Eres un editor de presentaciones académicas universitarias. "
            "Aplica la instrucción del usuario a la diapositiva proporcionada. "
            "Responde SIEMPRE en español. "
            "Conserva el slide_type a menos que la instrucción lo cambie explícitamente. "
            "Mantén los bullets concisos (máximo 2 líneas por bullet). "
            "Si la instrucción pide eliminar bullets, devuelve una lista vacía."
        ),
        tools=[_EDIT_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "edit_slide"},
        messages=[
            {
                "role": "user",
                "content": (
                    f"Diapositiva actual:\n{current_desc}\n\n"
                    f"Instrucción: {instruction}"
                ),
            }
        ],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "edit_slide":
            data = block.input
            return Slide(
                slide_type=data.get("slide_type", slide.slide_type),
                title=data.get("title", slide.title),
                bullets=data.get("bullets", slide.bullets),
            )

    return slide  # fallback: return original unchanged
