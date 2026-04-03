# Sprite Extraction Workflow

Extract individual graphics from composite SVG using viewBox manipulation.

## Step 1: Analyze Layout

Determine the grid/arrangement of sprites in the composite:

**What to discover:**
- Overall viewBox dimensions
- Number of sprites and arrangement (grid, row, column)
- Position and size of each sprite

## Step 2: Calculate ViewBox Coordinates

For each sprite, determine its viewBox: `x y width height`

**Example (3x2 grid of 6 ships):**
```javascript
const SPRITES = [
  { name: 'ship1', viewBox: '0 0 300 450' },      // Top-left
  { name: 'ship2', viewBox: '300 0 300 450' },    // Top-center
  { name: 'ship3', viewBox: '600 0 300 450' },    // Top-right
  { name: 'ship4', viewBox: '0 450 300 450' },    // Bottom-left
  { name: 'ship5', viewBox: '300 450 300 450' },  // Bottom-center
  { name: 'ship6', viewBox: '600 450 300 450' },  // Bottom-right
];
```

## Step 3: Extract via Script

Create a Node.js script that for each sprite:
1. Reads the optimized source SVG
2. Removes background (regex: `/<path[^>]*fill="#fff"[^>]*d="M0 0[^"]*"[^>]*\/>/g`)
3. Replaces viewBox with sprite-specific coordinates
4. Sets `width="100%"` and `height="100%"`
5. Adds `preserveAspectRatio="xMidYMid meet"`
6. Writes to individual file

**Result:** Each file contains ALL paths but displays only the clipped region via viewBox.
