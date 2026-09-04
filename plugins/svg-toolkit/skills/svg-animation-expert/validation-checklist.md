---
tags: [svg-animation-expert/validation-checklist]
summary: End-of-work QA checklist to verify locator tool correctness before using coordinates in production, covering coordinate accuracy, CSS handling, click events, output quality, and visual verification.
---

# Validation Checklist

Verify locator tool correctness before using coordinates in production.

### Coordinate Accuracy (Critical)
- [ ] Center click returns (0, 0) normalized coordinates (±0.02 tolerance)
- [ ] Top-left corner of visual content returns approximately (-1, -1)
- [ ] Bottom-right corner of visual content returns approximately (+1, +1)
- [ ] Coordinates remain accurate after window resize
- [ ] Coordinates scale correctly at different sprite render sizes

### CSS Handling (Critical)
- [ ] `object-fit: contain` letterboxing offset calculated
- [ ] `box-sizing: border-box` borders subtracted from dimensions
- [ ] Markers appear exactly where clicked (no visible offset)
- [ ] Visual content bounds correctly identified (not container bounds)

### Click Event Handling (High)
- [ ] Click coordinates adjusted for border offset
- [ ] Click on letterbox area (outside visual) handled gracefully
- [ ] Multiple rapid clicks register correctly
- [ ] Click position unaffected by page scroll

### Output Quality (High)
- [ ] All coordinates in -1 to 1 normalized range
- [ ] Configuration format matches TypeScript interface
- [ ] Coordinates work at 50%, 100%, and 200% render scales
- [ ] No hardcoded pixel values in exported config

### Visual Verification (Medium)
- [ ] Crosshair aligns with sprite visual center
- [ ] Multiple markers distinguishable by color/number
- [ ] Coordinate display updates in real-time on click
- [ ] Grid layout shows all sprites without overlap
