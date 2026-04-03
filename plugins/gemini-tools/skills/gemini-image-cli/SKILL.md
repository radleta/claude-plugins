---
name: gemini-image-cli
description: "Gemini image generation via gemini-image CLI — prompt engineering, reference images, model selection, and API best practices. Use when generating images with Gemini, writing image prompts, editing images with AI, using reference images, or calling the gemini-image script — even for simple single-image generations."
---

<role>
  <identity>Expert Gemini image generation specialist with CLI tooling knowledge</identity>

  <purpose>
    Generate high-quality images using the gemini-image CLI by crafting
    optimal prompts, selecting appropriate models, and applying reference
    image techniques based on Google's best practices
  </purpose>

  <expertise>
    <area>Gemini image generation prompt engineering</area>
    <area>Reference image techniques (editing, style transfer, composition)</area>
    <area>Model selection (Pro vs Flash) and parameter optimization</area>
    <area>gemini-image CLI syntax and workflow</area>
    <area>Text rendering, character consistency, and style control</area>
  </expertise>

  <scope>
    <in-scope>
      <item>Generating images via gemini-image CLI</item>
      <item>Crafting effective image prompts</item>
      <item>Using reference images for editing and style transfer</item>
      <item>Model and parameter selection</item>
      <item>Iterative image refinement workflows</item>
    </in-scope>

    <out-of-scope>
      <item>Gemini text-only API usage (use gemini-cli skill)</item>
      <item>Image processing/manipulation outside Gemini</item>
      <item>Training or fine-tuning models</item>
    </out-of-scope>
  </scope>
</role>

## CLI Setup

The `gemini-image` command is installed to `~/.local/bin/` via `install.sh` in this skill directory. Run `bash install.sh` from an elevated terminal if not yet installed.

## CLI Syntax

```bash
# Setup
gemini-image init                              # Store API key (interactive)
gemini-image init YOUR_KEY                     # Store API key (inline)

# Basic generation
gemini-image "a fox in snow"                   # Default: output.png, 1:1, 1K, pro
gemini-image "a fox in snow" -o fox.png        # Custom output path
gemini-image "a fox in snow" -a 16:9           # Landscape
gemini-image "a fox in snow" -s 2K             # Higher resolution
gemini-image "a fox in snow" -m flash          # Faster/cheaper model

# Combine options
gemini-image "a fox in snow" -a 16:9 -s 2K -o snow-fox.png

# Reference images (up to 14 with pro model)
gemini-image "make the background a beach" -i photo.jpg
gemini-image "combine these styles" -i style.png -i content.jpg
gemini-image "edit this image" -i input.png -o edited.png
```

| Flag | Long | Values | Default |
|------|------|--------|---------|
| `-o` | `--output` | Any path (.png) | `output.png` |
| `-a` | `--aspect` | 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9 | `1:1` |
| `-s` | `--size` | 1K, 2K, 4K (4K requires pro) | `1K` |
| `-m` | `--model` | pro, flash, or raw model ID | `pro` |
| `-i` | `--input` | Image file path (repeatable) | none |
| `-n` | `--dry-run` | Show config without calling API | off |

## Model Selection

| Model | ID | Quality | Speed | Cost/img | Max Refs | Best For |
|-------|-----|---------|-------|----------|----------|----------|
| **pro** (default) | gemini-3-pro-image-preview | Highest | 8-12s | ~$0.13 | 14 | Final assets, text in images, production |
| **flash** | gemini-2.5-flash-image | Good | ~3s | ~$0.04 | 3 | Drafts, iteration, high-volume |

**Strategy:** Use `flash` for rapid iteration and drafting, switch to `pro` for the final version.

## Prompt Engineering

Read [PROMPTING.md](PROMPTING.md) for the complete prompt engineering guide — covers the prompt structure formula, style/mood/lighting techniques, photographic language, and prompt templates for every use case.

**Quick formula:**
```
[Main subject] + [Details: colors, textures, actions] + [Style: photography, illustration, art movement] + [Technical: camera, lens, lighting] + [Mood: atmosphere, time of day, emotion]
```

**Core rules:**
1. **Describe the scene narratively** — paragraphs outperform keyword lists
2. **Be hyper-specific** — "ornate elven plate armor with silver leaf patterns" not "fantasy armor"
3. **Use photographic language** — "85mm portrait lens, golden hour, three-point softbox"
4. **State positives only** — "empty street" not "no cars" (model handles positive descriptions better)
5. **Say "generate an image of"** — explicit intent prevents text-only responses
6. **Iterate conversationally** — "keep everything but make the lighting warmer"

## Reference Images

Read [REFERENCE-IMAGES.md](REFERENCE-IMAGES.md) for the complete reference image guide — covers editing, style transfer, composition, character consistency, and multi-image workflows.

**Quick reference:**

| Technique | Command Pattern |
|-----------|----------------|
| Edit element | `gemini-image "change the sky to sunset" -i photo.jpg` |
| Style transfer | `gemini-image "apply this art style to the photo" -i style.png -i photo.jpg` |
| Combine images | `gemini-image "merge these into one scene" -i img1.png -i img2.png` |
| Background swap | `gemini-image "replace background with tropical beach" -i portrait.jpg` |

**Key rules:**
- Good refs: clear subjects, good lighting, consistent style
- Bad refs: blurry, cluttered, conflicting styles
- Output adopts the **last** reference image's aspect ratio
- When editing, explicitly say "do not change the aspect ratio"
- Pro supports up to 14 refs; flash supports up to 3

## Pre-Generation Checklist

Verify before running `gemini-image`:

**Setup**
- [ ] API key configured (`gemini-image init` completed)
- [ ] `gemini-image` command on PATH (`which gemini-image` succeeds)
- [ ] Python available (used internally for JSON/base64 handling)

**Prompt**
- [ ] Prompt explicitly requests image generation ("generate an image of...")
- [ ] Prompt uses positive descriptions (not negatives like "no X")
- [ ] Prompt includes style/lighting/mood details (not just subject)
- [ ] Text in images kept short (1-5 words) if any

**Input Images**
- [ ] Input files exist and are readable
- [ ] Input format is supported (PNG, JPEG, WebP, GIF)
- [ ] Reference image count within model limit (pro: 14, flash: 3)
- [ ] Reference images are clear, well-lit, not blurry

**Parameters**
- [ ] Aspect ratio is valid (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9)
- [ ] Size is valid (1K, 2K, 4K) — 4K requires pro model
- [ ] Model matches needs (flash for drafts, pro for final/text/4K)
- [ ] Output path is writable and has .png extension

**Post-Generation**
- [ ] Verify output file was created and has reasonable size
- [ ] Review text in images for accuracy (if any)
- [ ] Check faces/hands for artifacts (regenerate if needed)

## Limitations and Gotchas

Read [LIMITATIONS.md](LIMITATIONS.md) for the complete limitations reference — covers safety filters, rate limits, known issues, and workarounds.

**Critical to know:**
- **No transparent backgrounds** — generate on white, remove with external tools
- **Text rendering ~94% accurate** (pro) — always review text in images
- **Faces degrade after many edits** — restart conversation if faces warp
- **Hands still error-prone** — improved but not perfect
- **Copyright filter is non-configurable** — no copyrighted characters or real celebrities
- **Model may return text instead of image** — always include "generate an image" in prompt
