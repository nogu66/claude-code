# Draw.io XML Style Guide

## XML Structure

Every diagram uses this base structure:

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="900" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <!-- Swim lanes and shapes go here -->
  </root>
</mxGraphModel>
```

Adjust `pageWidth` based on the number of swim lanes (add ~200px per lane).

## Style Definitions

### Swim Lane Container

```
style="shape=table;startSize=0;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=0;strokeColor=#9BB8D3;fillColor=#D6E4F0;"
```

### Swim Lane Column

```
style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;"
```

### Swim Lane Body (inner area)

```
style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;"
```

### Process Box (Dark Navy Rounded Rectangle)

Use for: tasks, activities, operations, management functions.

```
style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;"
```

### Document Shape (Sky Blue Wave-Bottom)

Use for: documents, reports, invoices, forms, notifications, quotations, orders, contracts, bills.

```
style="shape=document;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=12;fontStyle=1;size=0.15;"
```

### Decision Diamond (Sky Blue)

Use for: conditions, branching logic, yes/no decisions.

```
style="rhombus;whiteSpace=wrap;html=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=11;fontStyle=1;"
```

### Database Cylinder (Sky Blue)

Use for: databases, data stores.

```
style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=12;fontStyle=1;size=15;"
```

### Start/End Stadium

Use for: start and end points.

```
style="stadium;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;"
```

### Arrow / Edge Connector

```
style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;"
```

## Cell Dimensions

| Shape | Width | Height |
|-------|-------|--------|
| Process box | 140 | 50 |
| Document shape | 120 | 60 |
| Decision diamond | 100 | 60 |
| Database cylinder | 100 | 60 |
| Start/End stadium | 120 | 40 |

## Swim Lane Construction

Build swim lanes using a table-based approach:

```xml
<!-- Outer table container -->
<mxCell id="table1" value="" style="shape=table;startSize=0;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=0;strokeColor=#9BB8D3;fillColor=#D6E4F0;" vertex="1" parent="1">
  <mxGeometry x="10" y="10" width="800" height="700" as="geometry" />
</mxCell>

<!-- Row container (one row spanning all columns) -->
<mxCell id="row1" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=12;fontStyle=0;strokeColor=inherit;" vertex="1" parent="table1">
  <mxGeometry y="0" width="800" height="700" as="geometry" />
</mxCell>

<!-- Column 1: Header + Body -->
<mxCell id="lane1_header" value="Role Name" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
  <mxGeometry x="0" y="0" width="200" height="700" as="geometry">
    <mxRectangle width="200" height="30" as="alternateBounds" />
  </mxGeometry>
</mxCell>
<mxCell id="lane1_body" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="lane1_header">
  <mxGeometry y="30" width="200" height="670" as="geometry" />
</mxCell>

<!-- Shapes go inside lane body cells -->
<mxCell id="process1" value="Customer&#xa;Management" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="lane1_body">
  <mxGeometry x="30" y="30" width="140" height="50" as="geometry" />
</mxCell>
```

## Text Formatting

- Use `&#xa;` for line breaks within shape labels
- Keep labels to 2-4 words per line
- Max 3 lines per shape
- All text: white (#FFFFFF), bold (fontStyle=1), centered

## Edge Connections

Connect shapes using source and target IDs:

```xml
<mxCell id="edge1" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="process1" target="process2" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

For cross-lane edges, set `parent="1"` (root level) so the arrow routes across lanes properly.
