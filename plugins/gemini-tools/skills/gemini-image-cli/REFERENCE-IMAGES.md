# Reference Images Guide

## Reference Image Limits by Model

| Model | Max Input Images | Max Objects | Max Characters |
|-------|-----------------|-------------|----------------|
| flash (2.5) | 3 | Limited | Limited |
| pro (3) | 14 | 6 | 5 |

Supported input formats: PNG, JPEG, WebP, GIF.

## Techniques

### Element Editing

Change specific parts of an image while preserving everything else:

```bash
# Change sky
gemini-image "change the sky to a dramatic sunset with orange and purple clouds" -i landscape.jpg -o sunset.png

# Swap outfit
gemini-image "change the shirt to a navy blue blazer, keep everything else identical" -i portrait.jpg

# Add element
gemini-image "add a golden retriever sitting next to the person, matching the lighting and perspective" -i photo.jpg

# Remove element
gemini-image "remove the car from the driveway, fill with matching grass and pavement" -i house.jpg
```

**Prompt pattern for edits:**
```
[Action: change/add/remove] [specific element] to/with [new description].
Keep everything else exactly the same, preserving original style, lighting, and composition.
```

### Style Transfer

Apply the visual style of one image to another:

```bash
# Art style from reference
gemini-image "transform this photograph using the painting style from the first image" -i monet-painting.jpg -i photo.jpg

# Color palette transfer
gemini-image "apply the color palette and mood from the first image to the second" -i warm-sunset.jpg -i cityscape.jpg
```

**Prompt pattern for style transfer:**
```
Apply the [specific style aspect: brushwork / color palette / rendering technique] from the first image
to the subject and composition of the second image. Maintain the second image's layout and subjects.
```

### Multi-Image Composition

Combine elements from multiple reference images:

```bash
# Merge subjects
gemini-image "place the cat from the first image on the couch from the second image, natural lighting" -i cat.jpg -i living-room.jpg

# Product in context
gemini-image "place this product on the table in the cafe scene, matching perspective and shadows" -i product.png -i cafe.jpg
```

### Background Replacement

```bash
gemini-image "replace the background with a tropical beach at sunset, maintain natural edge blending and consistent lighting on the subject" -i portrait.jpg -o beach-portrait.png
```

### Character Consistency

Maintain consistent appearance across multiple generations:

**Identity Header Method** — create a reusable character description block and copy it to every prompt:

```
[CHARACTER: Maya]
- Face: oval shape, high cheekbones, light freckles across nose
- Hair: shoulder-length auburn waves, side-parted
- Build: athletic, 5'8"
- Outfit: dark green field jacket, white t-shirt
- Unique markers: small scar on left eyebrow, silver ring on right index finger
```

Then use in prompts:
```bash
gemini-image "[paste CHARACTER block above]. Maya is standing in a rainy Tokyo street at night, neon signs reflecting on wet pavement. Cinematic, 35mm lens." -o maya-tokyo.png

gemini-image "[paste CHARACTER block above]. Maya is sitting at a rustic wooden table in a sunlit countryside kitchen, reading a letter. Warm natural light, shallow DoF." -o maya-kitchen.png
```

**Reference Image Anchoring** — provide a "canonical" image:

```bash
# Generate initial canonical image
gemini-image "[detailed character description]. Standing in a neutral gray studio, facing camera, even lighting." -o maya-reference.png

# Use as reference for all subsequent scenes
gemini-image "same person from the reference image, now hiking through autumn mountains" -i maya-reference.png -o maya-hiking.png
```

## Best Practices

### Good Reference Images

- **Clear subject** with unambiguous focus
- **Good lighting** — well-exposed, not too dark or blown out
- **Consistent style** — all refs should match the desired output aesthetic
- **Relevant content** — each ref should contribute something specific to the output
- **Sufficient resolution** — at least 512px on shortest side

### Bad Reference Images

- **Blurry or noisy** — artifacts propagate to output
- **Cluttered composition** — model can't isolate what you want
- **Conflicting styles** — mixing photorealistic and cartoon refs confuses the model
- **Watermarked or text-heavy** — text may persist in output
- **Very low resolution** — insufficient detail for the model to work with

### Aspect Ratio Behavior

- Output adopts the **last** reference image's aspect ratio when multiple images provided
- Override by specifying `-a` flag explicitly
- When editing a single image, add to prompt: "do not change the input aspect ratio"
- For compositing, provide a reference image at the target dimensions to control output ratio

### Multi-Turn Editing Workflow

For iterative refinement, generate a base image then edit it repeatedly:

```bash
# Step 1: Generate base
gemini-image "A cozy bookstore interior with warm lighting" -o bookstore-v1.png

# Step 2: Refine
gemini-image "Make the lighting warmer and add more books on the shelves" -i bookstore-v1.png -o bookstore-v2.png

# Step 3: Add detail
gemini-image "Add a sleeping orange cat on the reading chair" -i bookstore-v2.png -o bookstore-v3.png
```

**Important:** After many iterations (5+), faces and fine details can degrade. If quality drops, restart from a fresh generation with a more detailed prompt incorporating all the refinements you've accumulated.
