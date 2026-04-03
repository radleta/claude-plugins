# Gemini Image Generation Limitations

## Known Limitations

### No Transparent Backgrounds

Gemini cannot generate PNGs with alpha channel transparency.

**Workaround:** Generate on a solid white (or green) background, then remove the background with external tools (ImageMagick, rembg, Photoshop).

```bash
# Generate with explicit white background
gemini-image "a red cardinal bird on a pure white background, studio lighting" -o cardinal.png

# Remove background with rembg (pip install rembg)
rembg i cardinal.png cardinal-transparent.png
```

### Text Rendering

Text in images is ~94% accurate with pro model, ~80% with flash. Common issues:
- Letters transposed or duplicated
- Kerning inconsistencies
- Small text becomes illegible

**Maximize accuracy:**
1. Use pro model (`-m pro`)
2. Keep text short (1-5 words)
3. Use 2K+ resolution (`-s 2K`)
4. Specify font style explicitly
5. Put exact text in quotes in the prompt
6. Generate text separately, then compose

### Hands and Fingers

Improved but still error-prone. Extra or missing fingers, unnatural poses.

**Mitigate:** Avoid prompts that emphasize hands. If hands matter, use reference images and specify "anatomically correct hands with five fingers."

### Face Degradation in Multi-Turn Edits

After 5+ iterative edits, faces can become distorted or warped.

**Fix:** Restart from scratch with a comprehensive prompt that includes all refinements accumulated across iterations, rather than continuing to edit.

### Exact Quantity Control

The model may not produce the exact number of objects requested. "Generate 5 butterflies" may produce 4 or 6.

**Mitigate:** Be explicit: "exactly five butterflies arranged in a V formation." Verify and regenerate if count is wrong.

## Safety Filters

### Two-Layer System

**Layer 1 — Configurable (via API `safety_settings`):**
- Categories: harassment, hate speech, sexually explicit, dangerous content
- Thresholds: `OFF`, `BLOCK_NONE`, `BLOCK_ONLY_HIGH`, `BLOCK_MEDIUM_AND_ABOVE`, `BLOCK_LOW_AND_ABOVE`
- Default for Gemini 2.5/3: `OFF` (filters disabled)
- Error indicator: `blockReason: SAFETY`

**Layer 2 — Non-configurable (cannot be bypassed):**
- Copyright protection: copyrighted characters, logos, branded content
- Famous persons: realistic images of identifiable real people
- Child safety: mandatory, no override
- Error indicator: `blockReason: OTHER` or `finishReason: IMAGE_SAFETY`

### When You Hit a Safety Filter

1. Check the API response for `blockReason` or `finishReason`
2. If `SAFETY` — adjust safety_settings thresholds (Layer 1)
3. If `OTHER` or `IMAGE_SAFETY` — content is blocked at Layer 2, cannot bypass
4. For copyright: describe the style characteristics instead of naming characters
5. For real people: use fictional character descriptions instead

## Rate Limits

- Vary by model and tier (free vs paid)
- Key metric: Images Per Minute (IPM)
- Paid tier has higher limits
- Check limits at: AI Studio Rate Limit dashboard
- **Batch API** offers 50% cost discount for async processing (up to 24-hour turnaround)

## Output Details

- Images returned as base64-encoded data
- MIME type: `image/png` or `image/jpeg`
- All generated images include invisible **SynthID watermark** (statistical, not visible, no quality impact)
- No visible watermark on API-generated images (consumer app images have visible watermarks)

## Model-Specific Limitations

| Limitation | Pro | Flash |
|-----------|-----|-------|
| Max resolution | 4K | 1K |
| Max reference images | 14 | 3 |
| 4K resolution | Yes | No |
| thinkingConfig | No | No (3.1 Flash only) |
| Aspect ratios | All 10 | All 10 |
| Speed | 8-12s | ~3s |
| Style transfer quality | Better | Limited |
| Text accuracy | ~94% | ~80% |

## Troubleshooting

### "No image in response"

The model returned text instead of an image. Causes:
- Prompt didn't explicitly request image generation
- Safety filter blocked the image
- Ambiguous prompt interpreted as text request

**Fix:** Add "generate an image of" to the start of your prompt.

### "API returned HTTP 429"

Rate limit exceeded.

**Fix:** Wait and retry. Consider using flash model for lower cost, or batch API for high-volume work.

### "API returned HTTP 400"

Invalid request. Common causes:
- Invalid aspect ratio value
- Invalid image size
- Corrupted or unsupported input image format
- Missing API key
- Request body too large (too many/too large reference images)

### Image Quality Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blurry output | Low resolution | Use `-s 2K` or `-s 4K` (pro only) |
| Generic/boring | Vague prompt | Add specific style, lighting, mood details |
| Wrong style | Insufficient style direction | Add art movement, technique, medium details |
| Inconsistent series | Style drift | Use identical style prefix for all prompts |
| Artifacts in edited areas | Poor reference image | Use higher quality reference with clear subjects |
