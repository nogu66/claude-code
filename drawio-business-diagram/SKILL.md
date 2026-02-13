---
name: drawio-business-diagram
description: Create professional business process diagrams in draw.io with a consistent corporate design style featuring dark navy process boxes, sky blue document shapes, and vertical swim lanes. Uses the draw.io MCP tool (open_drawio_xml) to render diagrams directly in the browser. Use when the user asks to create flowcharts, business process diagrams, swim lane diagrams, workflow diagrams, organizational process visualizations, or any diagram in draw.io format. Also use when the user mentions draw.io, mxGraph, or requests process flow visualization.
---

# Draw.io Business Process Diagram Creator

Generate professional business process diagrams in a consistent corporate design style using the draw.io MCP integration.

## Design Style

**Color Palette:**
- Process boxes: Dark navy `#1B365C`, stroke `#0D1B2A`, white text
- Document/data shapes: Sky blue `#4A90D9`, stroke `#2E6DA4`, white text
- Swim lane background: Light lavender `#D6E4F0`, stroke `#9BB8D3`
- Swim lane header text: Dark navy `#1B365C`, bold
- Arrows: Black `#000000`, orthogonal routing, block end arrows
- Decision diamonds: Sky blue `#4A90D9`, white text

**Shape Mapping:**
- Process / task / activity → Rounded rectangle (dark navy)
- Document / report / invoice / form / notification → Document shape with wave bottom (sky blue)
- Decision / condition → Diamond (sky blue)
- Data / database → Cylinder (sky blue)
- Start / End → Stadium shape (dark navy)

## Workflow

1. Understand the business process: roles, steps, documents, decisions
2. Identify swim lanes (one per role/department)
3. Map each process step to the correct shape using the shape mapping above
4. Generate draw.io XML following the style definitions in [references/style-guide.md](references/style-guide.md)
5. Render using `mcp__drawio__open_drawio_xml` with the generated XML

## Rendering

Always render the final diagram using the draw.io MCP tool:

```
mcp__drawio__open_drawio_xml(content=<generated_xml>)
```

## Layout Guidelines

- Swim lanes: vertical columns, left-to-right (one per role/department)
- Process flow: top-to-bottom within each lane
- Cross-lane connections: horizontal arrows
- Spacing: ~40px between shapes vertically, lanes 180-220px wide
- Align related processes at the same vertical level across lanes
- Text: concise, 2-4 words per line, max 3 lines per shape
- All text centered within shapes, white color, bold

## Resources

- **Style definitions and XML structure**: [references/style-guide.md](references/style-guide.md) — read this for the complete XML style strings and mxGraphModel structure
- **Example templates**: [references/diagram-templates.md](references/diagram-templates.md) — read this for complete working examples of common diagram types
