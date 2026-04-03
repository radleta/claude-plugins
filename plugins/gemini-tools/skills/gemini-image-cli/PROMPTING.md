# Gemini Image Prompt Engineering

## The Prompt Structure Formula

Build prompts using 5 layers. Include all that apply — more layers produce better results:

```
1. Main subject — what's the focus
2. Details — colors, textures, actions, context
3. Style — photography, illustration, specific art movement
4. Technical — camera angle, lens, lighting setup
5. Mood — atmosphere, time of day, emotion
```

## Core Principles

### Describe Scenes, Don't List Keywords

Narrative descriptions outperform disconnected keyword lists. The model has strong language comprehension.

```
Bad:  fox, snow, winter, photorealistic, 4K
Good: A red fox sitting in fresh powder snow, its breath visible in the cold morning air,
      with snow-covered pine trees in the background. Photorealistic, natural lighting.
```

### Be Hyper-Specific

Vague descriptions produce generic results. Specificity controls the output:

```
Bad:  A warrior in fantasy armor
Good: A battle-scarred elven warrior wearing ornate mithril plate armor etched with silver
      leaf patterns, high collar with falcon-wing pauldrons, standing in a misty forest
      clearing at dawn
```

### Use Photographic and Cinematic Language

Camera and lighting terms give precise control over composition:

**Camera angles:** wide-angle, close-up, macro, low-angle, high-angle, Dutch angle, bird's-eye view, over-the-shoulder, extreme close-up

**Lens specs:** 85mm portrait lens, 35mm wide-angle, 50mm standard, 200mm telephoto, tilt-shift, fisheye

**Lighting:** golden hour, blue hour, Rembrandt lighting, rim lighting, three-point softbox, harsh midday sun, overcast diffused, backlit silhouette, neon glow, chiaroscuro, volumetric fog with light rays

**Depth of field:** shallow DoF (blurred background), deep focus (everything sharp), bokeh, selective focus

### State Positives, Not Negatives

The model handles positive descriptions much better than exclusions:

```
Bad:  A street scene with no cars, no people, no trash
Good: A deserted cobblestone street at 4am, empty and pristine, with closed shop fronts
      and a single streetlamp casting warm light
```

### Be Explicit About Image Generation

Ambiguous prompts may produce text descriptions instead of images:

```
Bad:  A sunset over the ocean
Good: Generate an image of a vivid sunset over the Pacific Ocean with deep orange and
      purple clouds reflected on calm water
```

## Prompt Templates

### Photorealistic Portrait

```
A photorealistic close-up portrait of [subject: age, ethnicity, distinguishing features],
set in [environment]. Illuminated by [lighting type] streaming through [source].
Captured with an 85mm portrait lens at f/1.8 with shallow depth of field.
Fine details: [skin texture, hair, clothing material]. [Mood/expression].
```

### Product Photography

```
High-resolution studio product photograph of [product] on [surface: marble, wood, fabric].
[Lighting: three-point softbox / single key light with fill] creating [shadow style].
Shot from [angle: 45-degree, flat lay, three-quarter] showcasing [key features].
Ultra-sharp focus on [detail area]. Clean, professional composition for e-commerce.
```

### Landscape / Environment

```
[Time of day] [environment type] landscape. [Foreground elements] leading into
[midground elements] with [background/sky description]. [Weather/atmosphere].
[Lighting conditions]. Captured with a [lens: 24mm wide-angle / 70mm standard].
[Color palette: warm earth tones / cool blues / vibrant saturated].
```

### Logo / Text Design

```
Create a modern, [aesthetic: minimalist / bold / vintage] logo for '[exact text]'.
Text rendered in [font style: sans-serif / serif / handwritten] font.
Integrated with a [icon/symbol description]. Color scheme: [specific colors].
[Layout: horizontal / stacked / circular emblem]. Clean vector-style rendering.
```

### Stylized Illustration

```
A [style: watercolor / cel-shaded / art nouveau / pixel art]-style illustration
of [subject] in [setting]. [Line style: bold outlines / soft edges / no outlines].
[Shading: flat / gradient / crosshatch]. Color palette: [specific colors or mood].
Background: [solid color / detailed scene / gradient].
```

### Minimalist / Marketing

```
Minimalist composition featuring [subject] positioned in [location: center / rule-of-thirds].
Vast negative space with [background: pure white / gradient / solid color].
[Subtle lighting]. Designed for text overlay on [position: right half / bottom third].
Clean, modern aesthetic suitable for [use case: social media / print ad / website hero].
```

### Food Photography

```
Overhead [or: 45-degree angle] food photograph of [dish] on [surface/plate].
[Garnish and styling details]. Natural window light from [direction] with
[shadow quality: soft / dramatic]. [Props: utensils, napkin, ingredients scattered].
Shallow depth of field with focus on [focal point]. Warm, appetizing color grading.
```

## Style Control Techniques

### Consistent Style Across Multiple Images

Lock your style by using identical technical specifications in every prompt:

```
Style prefix (copy to every prompt):
"Digital illustration style. Bold outlines, flat shading, limited color palette
of navy, coral, and cream. Slightly textured paper background. 16:9 aspect ratio."
```

### Art Movement References

| Style | Prompt Keywords |
|-------|----------------|
| Impressionist | "soft brushstrokes, dappled light, en plein air, Monet-inspired palette" |
| Art Deco | "geometric patterns, gold and black, symmetrical, streamlined, 1920s glamour" |
| Ukiyo-e | "Japanese woodblock print, flat perspective, bold outlines, natural pigments" |
| Bauhaus | "geometric shapes, primary colors, sans-serif typography, functional design" |
| Cyberpunk | "neon-lit, rain-slicked streets, holographic displays, dystopian, high contrast" |
| Studio Ghibli | "hand-painted, pastoral, whimsical, detailed backgrounds, soft lighting" |
| Vaporwave | "retro-futuristic, pink and cyan, Greek statues, sunset gradients, 80s aesthetics" |

### Mood and Atmosphere

| Mood | Prompt Keywords |
|------|----------------|
| Serene | "calm, peaceful, soft light, muted colors, gentle, tranquil" |
| Dramatic | "high contrast, chiaroscuro, deep shadows, intense, bold" |
| Whimsical | "playful, fantasy, bright colors, magical, dreamlike" |
| Gritty | "urban decay, textured, desaturated, raw, weathered" |
| Ethereal | "glowing, translucent, misty, otherworldly, luminous" |
| Nostalgic | "warm tones, film grain, faded, vintage, golden light" |

## Advanced Prompt Techniques

### Break Complex Prompts Into Steps

For intricate scenes, layer instructions:

```
Generate an image with these elements:
First, a vast desert landscape at golden hour with towering red rock formations.
Then, in the foreground, a lone astronaut in a weathered white spacesuit kneeling
to examine a small green plant growing from the sand.
The sky should show both a setting sun and a large ringed planet visible through
thin clouds. Photorealistic, cinematic composition, wide-angle lens.
```

### Controlling Text in Images

Text rendering is imperfect. Maximize accuracy:

1. Use the **pro** model (`-m pro`) — 94% accuracy vs 80% for flash
2. Keep text short (1-5 words works best)
3. Specify font style explicitly: "bold sans-serif", "elegant serif", "hand-lettered"
4. State exact text in quotes: `the text "HELLO WORLD" in bold white letters`
5. Specify placement: "centered at the top", "bottom-right corner"
6. Generate at 2K+ resolution for readable text

### Controlling Composition

Use spatial language for precise layout:

```
Rule of thirds: "Subject positioned at the left third intersection point"
Foreground/background: "Flowers in sharp focus foreground, castle soft-focus background"
Negative space: "Subject in lower-left quadrant, vast empty sky filling upper-right"
Framing: "Viewed through an arched stone doorway"
Leading lines: "A winding path drawing the eye from bottom-center to the horizon"
```

## Anti-Patterns

| Problem | Why It Fails | Fix |
|---------|-------------|-----|
| Keyword soup: "cat, cute, fluffy, 4K, HDR" | No context or relationships between elements | Write a narrative sentence describing the scene |
| Negatives: "no background, no watermark" | Model handles positive instructions better | Describe what you want instead |
| Too short: "a dog" | Insufficient detail for quality output | Add style, lighting, setting, mood |
| Too long (500+ words) | Model may lose focus on key details | Keep to 2-4 sentences, prioritize important details |
| Contradictory: "minimalist but highly detailed" | Conflicting instructions confuse the model | Choose one direction and commit |
| Copying famous artists by name | May trigger copyright filters | Describe the style characteristics instead |
| Requesting exact pixel counts | API uses preset sizes (1K/2K/4K) | Use `-s` flag with valid size values |
