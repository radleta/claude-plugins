---
name: svg-animation-expert
description: "Validated techniques for creating interactive HTML tools that precisely locate animation anchor points on SVG/PNG graphics. Use when building engine thrust effects, particle emitters, sprite attachment points, or any visual effect requiring precise coordinate mapping — even for simple single-point anchors."
---

<role>
  <identity>Expert in SVG animation point locator tool development</identity>

  <purpose>
    Guide creation of interactive HTML tools for precisely marking animation
    anchor points on graphics, with techniques for accurate coordinate mapping
  </purpose>

  <expertise>
    <area>Interactive HTML locator tool architecture</area>
    <area>CSS object-fit and letterboxing calculations</area>
    <area>box-sizing border adjustments for coordinate systems</area>
    <area>Normalized coordinate transformations (-1 to 1 range)</area>
    <area>Multi-point animation configurations (engines, particles, attachments)</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Creating HTML tools for marking animation points on images</item>
      <item>Solving coordinate offset issues (letterboxing, borders)</item>
      <item>Generating normalized coordinate configurations</item>
      <item>Ship engine placement, particle emitter positioning</item>
      <item>Any sprite/graphic requiring precise anchor points</item>
    </in-scope>

    <out-of-scope>
      <item>Actual SVG animation implementation (CSS/JS animation code)</item>
      <item>SVG path manipulation or optimization</item>
      <item>Game engine integration specifics</item>
    </out-of-scope>
  </scope>
</role>

---

## Problem This Skill Solves

Precise anchor points prevent these failures:
- Effects offset from intended positions
- Trial-and-error coordinate adjustment
- Inconsistent positioning across sprite sizes

**Solution:** Create an interactive HTML locator tool that outputs normalized coordinates on click.

---

## Complete Example Reference

For projects using this pattern, create an `engine-locator.html` tool using the architecture described in [locator-tool-architecture/](locator-tool-architecture/index.md). A working implementation should include:
- Center crosshair positioning
- Multiple point markers with visual indicators
- Real-time normalized coordinate output display
- Grid layout for multiple sprites/assets

---

## Workflow

<workflow type="sequential">
  <step id="1-create-tool" order="first">
    <description>Create locator HTML tool with container grid for all sprites</description>
    <actions>
      <action>Create HTML file with grid layout for sprite containers</action>
      <action>Add img elements for each sprite/asset</action>
      <action>Add marker container divs for crosshairs and points</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">HTML file opens in browser without errors</criterion>
      <criterion priority="critical">All sprite images visible in grid layout</criterion>
      <criterion priority="high">Containers sized appropriately (300-400px typical)</criterion>
    </acceptance-criteria>
    <blocks>2-apply-css</blocks>
  </step>

  <step id="2-apply-css" order="second" depends-on="1-create-tool">
    <description>Apply CSS with object-fit and box-sizing handling</description>
    <actions>
      <action>Set container position: relative with explicit dimensions</action>
      <action>Set img to object-fit: contain with pointer-events: none</action>
      <action>Style markers with transform: translate(-50%, -50%) for centering</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Images maintain aspect ratio (no stretching)</criterion>
      <criterion priority="high">Images centered within containers</criterion>
      <criterion priority="high">Marker styles visible and positioned absolutely</criterion>
    </acceptance-criteria>
    <blocks>3-click-handlers</blocks>
  </step>

  <step id="3-click-handlers" order="third" depends-on="2-apply-css">
    <description>Implement click handlers with border and letterboxing adjustments</description>
    <actions>
      <action>Add click listener to each container</action>
      <action>Implement getContentDimensions() for border adjustment</action>
      <action>Implement calculateLetterboxing() for visual bounds</action>
      <action>Apply both adjustments before coordinate calculation</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Click on visual center returns (0, 0) normalized</criterion>
      <criterion priority="critical">No offset errors from borders or letterboxing</criterion>
      <criterion priority="high">Console shows coordinates on each click</criterion>
    </acceptance-criteria>
    <blocks>4-mark-center</blocks>
  </step>

  <step id="4-mark-center" order="fourth" depends-on="3-click-handlers">
    <description>Mark center point to establish coordinate origin</description>
    <actions>
      <action>Click on sprite visual center</action>
      <action>Verify crosshair appears exactly at click position</action>
      <action>Store center as reference point for normalization</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Crosshair visually aligned with sprite center</criterion>
      <criterion priority="high">Center coordinates stored for subsequent calculations</criterion>
    </acceptance-criteria>
    <blocks>5-mark-points</blocks>
  </step>

  <step id="5-mark-points" order="fifth" depends-on="4-mark-center">
    <description>Mark animation anchor points and capture normalized coordinates</description>
    <actions>
      <action>Click on each animation point (engines, emitters, attachments)</action>
      <action>Verify marker appears at exact click position</action>
      <action>Record normalized coordinates displayed</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Markers appear exactly where clicked</criterion>
      <criterion priority="critical">Coordinates in -1 to 1 range</criterion>
      <criterion priority="high">Multiple points distinguishable visually</criterion>
    </acceptance-criteria>
    <blocks>6-export</blocks>
  </step>

  <step id="6-export" order="sixth" depends-on="5-mark-points">
    <description>Export configuration and integrate into animation system</description>
    <actions>
      <action>Copy normalized coordinates to configuration object</action>
      <action>Format as TypeScript/JavaScript config matching AnimationPointConfig</action>
      <action>Import into animation system</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Config matches AnimationPointConfig interface</criterion>
      <criterion priority="high">All sprites have complete point data</criterion>
    </acceptance-criteria>
    <blocks>7-verify</blocks>
  </step>

  <step id="7-verify" order="seventh" depends-on="6-export">
    <description>Verify coordinates work at different render sizes</description>
    <actions>
      <action>Test animation with sprites at 50% scale</action>
      <action>Test animation with sprites at 200% scale</action>
      <action>Verify effects appear at correct positions regardless of size</action>
    </actions>
    <acceptance-criteria>
      <criterion priority="critical">Effects positioned correctly at all scales</criterion>
      <criterion priority="critical">No pixel-based offset errors</criterion>
      <criterion priority="high">Visual confirmation of scale-independence</criterion>
    </acceptance-criteria>
  </step>
</workflow>

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Points offset to the right | box-sizing: border-box not accounted for | Subtract border widths from container size (see [border-box.md](coordinate-pitfalls/border-box.md)) |
| Points offset from visual | object-fit letterboxing not calculated | Calculate visual bounds within img element (see [letterboxing.md](coordinate-pitfalls/letterboxing.md)) |
| Points scale incorrectly | Using pixel coordinates instead of normalized | Convert to -1 to 1 range relative to center (see [normalized-coordinates.md](normalized-coordinates.md)) |
| Crosshair not centered on click | getBoundingClientRect includes border | Adjust by borderLeft/borderTop (see [click-position.md](coordinate-pitfalls/click-position.md)) |

---

## Pages
- [Use Cases](use-cases.md) — Request patterns and trigger keywords that indicate when to apply this skill
- [Coordinate Pitfalls](coordinate-pitfalls/index.md) — Three critical coordinate system pitfalls: letterboxing, border-box, and click position
- [Normalized Coordinates](normalized-coordinates.md) — How to store and convert coordinates as normalized (-1 to 1) values for scale-independent positioning
- [Locator Tool Architecture](locator-tool-architecture/index.md) — HTML structure, CSS requirements, and JavaScript flow for building the locator tool
- [Output Format](output-format.md) — TypeScript interface and example config for exporting normalized anchor point coordinates
- [Validation Checklist](validation-checklist.md) — End-of-work QA checklist to verify locator tool correctness before production use

## Meta
- [Operations Log](log.md) — Timestamped wiki operations log (ingest, lint, query filings)
- [Schema](schema.md) — Wiki conventions and page-type definitions
