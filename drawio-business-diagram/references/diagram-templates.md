# Diagram Templates

## Template 1: Simple 3-Lane Business Process

A sales order process with 3 roles.

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="700" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="table1" value="" style="shape=table;startSize=0;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=0;strokeColor=#9BB8D3;fillColor=#D6E4F0;" vertex="1" parent="1">
      <mxGeometry x="10" y="10" width="600" height="500" as="geometry" />
    </mxCell>
    <mxCell id="row1" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=12;fontStyle=0;strokeColor=inherit;" vertex="1" parent="table1">
      <mxGeometry y="0" width="600" height="500" as="geometry" />
    </mxCell>
    <!-- Lane 1: Sales Rep -->
    <mxCell id="l1h" value="Sales Rep" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
      <mxGeometry x="0" y="0" width="200" height="500" as="geometry">
        <mxRectangle width="200" height="30" as="alternateBounds" />
      </mxGeometry>
    </mxCell>
    <mxCell id="l1b" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="l1h">
      <mxGeometry y="30" width="200" height="470" as="geometry" />
    </mxCell>
    <mxCell id="p1" value="Receive&#xa;Order" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l1b">
      <mxGeometry x="30" y="30" width="140" height="50" as="geometry" />
    </mxCell>
    <mxCell id="d1" value="Sales&#xa;Order" style="shape=document;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=12;fontStyle=1;size=0.15;" vertex="1" parent="l1b">
      <mxGeometry x="40" y="120" width="120" height="60" as="geometry" />
    </mxCell>
    <!-- Lane 2: Warehouse -->
    <mxCell id="l2h" value="Warehouse" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
      <mxGeometry x="200" y="0" width="200" height="500" as="geometry">
        <mxRectangle width="200" height="30" as="alternateBounds" />
      </mxGeometry>
    </mxCell>
    <mxCell id="l2b" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="l2h">
      <mxGeometry y="30" width="200" height="470" as="geometry" />
    </mxCell>
    <mxCell id="p2" value="Pick &amp;&#xa;Pack" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l2b">
      <mxGeometry x="30" y="120" width="140" height="50" as="geometry" />
    </mxCell>
    <mxCell id="p3" value="Ship&#xa;Product" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l2b">
      <mxGeometry x="30" y="220" width="140" height="50" as="geometry" />
    </mxCell>
    <!-- Lane 3: Finance -->
    <mxCell id="l3h" value="Finance" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
      <mxGeometry x="400" y="0" width="200" height="500" as="geometry">
        <mxRectangle width="200" height="30" as="alternateBounds" />
      </mxGeometry>
    </mxCell>
    <mxCell id="l3b" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="l3h">
      <mxGeometry y="30" width="200" height="470" as="geometry" />
    </mxCell>
    <mxCell id="d2" value="Invoice" style="shape=document;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=12;fontStyle=1;size=0.15;" vertex="1" parent="l3b">
      <mxGeometry x="40" y="220" width="120" height="60" as="geometry" />
    </mxCell>
    <mxCell id="p4" value="Process&#xa;Payment" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l3b">
      <mxGeometry x="30" y="330" width="140" height="50" as="geometry" />
    </mxCell>
    <!-- Edges (cross-lane at root level) -->
    <mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="p1" target="d1" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e2" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="d1" target="p2" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e3" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="p2" target="p3" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e4" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="p3" target="d2" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e5" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="d2" target="p4" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>
```

## Template 2: Process with Decision

A support ticket workflow with a decision point.

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="900" pageHeight="700" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="table1" value="" style="shape=table;startSize=0;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=0;strokeColor=#9BB8D3;fillColor=#D6E4F0;" vertex="1" parent="1">
      <mxGeometry x="10" y="10" width="400" height="600" as="geometry" />
    </mxCell>
    <mxCell id="row1" value="" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=12;fontStyle=0;strokeColor=inherit;" vertex="1" parent="table1">
      <mxGeometry y="0" width="400" height="600" as="geometry" />
    </mxCell>
    <!-- Lane 1: Support -->
    <mxCell id="l1h" value="Support" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
      <mxGeometry x="0" y="0" width="200" height="600" as="geometry">
        <mxRectangle width="200" height="30" as="alternateBounds" />
      </mxGeometry>
    </mxCell>
    <mxCell id="l1b" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="l1h">
      <mxGeometry y="30" width="200" height="570" as="geometry" />
    </mxCell>
    <mxCell id="p1" value="Receive&#xa;Ticket" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l1b">
      <mxGeometry x="30" y="30" width="140" height="50" as="geometry" />
    </mxCell>
    <mxCell id="dec1" value="Urgent?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#4A90D9;strokeColor=#2E6DA4;fontColor=#FFFFFF;fontSize=11;fontStyle=1;" vertex="1" parent="l1b">
      <mxGeometry x="50" y="130" width="100" height="60" as="geometry" />
    </mxCell>
    <mxCell id="p2" value="Standard&#xa;Resolution" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l1b">
      <mxGeometry x="30" y="240" width="140" height="50" as="geometry" />
    </mxCell>
    <!-- Lane 2: Engineering -->
    <mxCell id="l2h" value="Engineering" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
      <mxGeometry x="200" y="0" width="200" height="600" as="geometry">
        <mxRectangle width="200" height="30" as="alternateBounds" />
      </mxGeometry>
    </mxCell>
    <mxCell id="l2b" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="l2h">
      <mxGeometry y="30" width="200" height="570" as="geometry" />
    </mxCell>
    <mxCell id="p3" value="Emergency&#xa;Fix" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="l2b">
      <mxGeometry x="30" y="130" width="140" height="50" as="geometry" />
    </mxCell>
    <!-- Edges -->
    <mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="p1" target="dec1" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e2" value="No" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;fontSize=11;fontStyle=1;" edge="1" source="dec1" target="p2" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="e3" value="Yes" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;fontSize=11;fontStyle=1;" edge="1" source="dec1" target="p3" parent="1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>
```

## Common Patterns

### Adding a New Lane

Copy the lane header + body pattern, increment the `x` position by the lane width (200px):

```xml
<mxCell id="lNh" value="New Role" style="swimlane;startSize=30;swimlaneHead=1;swimlaneBody=0;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=1;strokeColor=#9BB8D3;fontSize=13;fontColor=#1B365C;" vertex="1" parent="row1">
  <mxGeometry x="[previous_x + 200]" y="0" width="200" height="[total_height]" as="geometry">
    <mxRectangle width="200" height="30" as="alternateBounds" />
  </mxGeometry>
</mxCell>
<mxCell id="lNb" value="" style="swimlane;startSize=0;swimlaneHead=0;swimlaneBody=1;fillColor=#D6E4F0;collapsible=0;dropTarget=0;fontStyle=0;strokeColor=#9BB8D3;" vertex="1" parent="lNh">
  <mxGeometry y="30" width="200" height="[total_height - 30]" as="geometry" />
</mxCell>
```

### Adding Shapes Inside a Lane

Place shapes with `parent` set to the lane body cell ID:

```xml
<mxCell id="newProcess" value="Task Name" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1B365C;strokeColor=#0D1B2A;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=20;" vertex="1" parent="[lane_body_id]">
  <mxGeometry x="30" y="[vertical_position]" width="140" height="50" as="geometry" />
</mxCell>
```

### Cross-Lane Arrow

Always set `parent="1"` for edges crossing lanes:

```xml
<mxCell id="crossEdge" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;endArrow=block;endFill=1;" edge="1" source="[source_id]" target="[target_id]" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```
