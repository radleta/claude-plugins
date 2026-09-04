# Template: Event Handlers Reference

**When to Use**: Reference for properly typing all common React event handlers.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Using `any` for event types
- Using wrong event type (Event vs React.MouseEvent, etc.)
- Not using React synthetic event types
- Mixing native and React event types

## Template: All Common Event Types

```typescript
import React from 'react';

/**
 * Comprehensive event handler reference component
 * Shows correct typing for all common React events
 */
export function EventHandlersReference() {
  /**
   * MOUSE EVENTS
   */

  // Click events
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Button clicked', event.clientX, event.clientY);
  };

  const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Div clicked');
  };

  // Double click
  const handleDoubleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Double clicked');
  };

  // Mouse enter/leave
  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Mouse entered');
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Mouse left');
  };

  // Mouse over/out
  const handleMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Mouse over');
  };

  const handleMouseOut = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Mouse out');
  };

  // Mouse move
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('Mouse position:', event.clientX, event.clientY);
  };

  /**
   * FORM EVENTS
   */

  // Text input change
  const handleTextInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    console.log('Input value:', value);
  };

  // Textarea change
  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    console.log('Textarea value:', value);
  };

  // Select change
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    console.log('Selected:', value);
  };

  // Checkbox change
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    console.log('Checkbox checked:', checked);
  };

  // Radio change
  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    console.log('Radio selected:', value);
  };

  // Form submit
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // CRITICAL: Prevent page reload
    console.log('Form submitted');
  };

  // Input focus
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    console.log('Input focused');
  };

  // Input blur
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    console.log('Input blurred');
  };

  /**
   * KEYBOARD EVENTS
   */

  // Key down
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('Key pressed:', event.key);

    // Check for specific keys
    if (event.key === 'Enter') {
      console.log('Enter pressed');
    }

    if (event.key === 'Escape') {
      console.log('Escape pressed');
    }

    // Check for modifier keys
    if (event.ctrlKey || event.metaKey) {
      console.log('Ctrl/Cmd pressed');
    }

    if (event.shiftKey) {
      console.log('Shift pressed');
    }

    if (event.altKey) {
      console.log('Alt pressed');
    }
  };

  // Key up
  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('Key released:', event.key);
  };

  // Key press (deprecated, use keydown instead)
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('Key press:', event.key);
  };

  /**
   * DRAG AND DROP EVENTS
   */

  // Drag start
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    console.log('Drag started');
  };

  // Drag over
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Required to allow drop
    console.log('Dragging over');
  };

  // Drop
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('text');
    console.log('Dropped:', data);
  };

  // Drag end
  const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    console.log('Drag ended');
  };

  /**
   * CLIPBOARD EVENTS
   */

  // Copy
  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    console.log('Content copied');
  };

  // Cut
  const handleCut = (event: React.ClipboardEvent<HTMLDivElement>) => {
    console.log('Content cut');
  };

  // Paste
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');
    console.log('Pasted:', pastedText);
  };

  /**
   * SCROLL EVENTS
   */

  // Scroll
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    console.log('Scroll position:', element.scrollTop);
  };

  /**
   * TOUCH EVENTS (Mobile)
   */

  // Touch start
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    console.log('Touch started');
  };

  // Touch move
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    console.log('Touch moving');
  };

  // Touch end
  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    console.log('Touch ended');
  };

  /**
   * ANIMATION EVENTS
   */

  // Animation start
  const handleAnimationStart = (event: React.AnimationEvent<HTMLDivElement>) => {
    console.log('Animation started:', event.animationName);
  };

  // Animation end
  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    console.log('Animation ended:', event.animationName);
  };

  /**
   * TRANSITION EVENTS
   */

  // Transition end
  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    console.log('Transition ended:', event.propertyName);
  };

  /**
   * WHEEL EVENTS
   */

  // Wheel (scroll wheel)
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    console.log('Wheel delta:', event.deltaY);
  };

  return (
    <div className="event-handlers-demo">
      {/* Mouse Events */}
      <button onClick={handleClick} onDoubleClick={handleDoubleClick}>
        Click Me
      </button>

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        Hover over me
      </div>

      {/* Form Events */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          onChange={handleTextInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        <textarea onChange={handleTextareaChange} />

        <select onChange={handleSelectChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </select>

        <input type="checkbox" onChange={handleCheckboxChange} />

        <button type="submit">Submit</button>
      </form>

      {/* Drag and Drop */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        Drag me
      </div>

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        Drop here
      </div>

      {/* Scroll */}
      <div onScroll={handleScroll} style={{ height: 200, overflow: 'auto' }}>
        Scrollable content
      </div>
    </div>
  );
}
```

## Quick Reference Table

| Event Category | Event Handler | Type |
|---------------|---------------|------|
| **Mouse** | onClick, onDoubleClick | `React.MouseEvent<HTMLElement>` |
| | onMouseEnter, onMouseLeave | `React.MouseEvent<HTMLElement>` |
| | onMouseOver, onMouseOut | `React.MouseEvent<HTMLElement>` |
| | onMouseMove, onMouseDown, onMouseUp | `React.MouseEvent<HTMLElement>` |
| **Form** | onChange (input) | `React.ChangeEvent<HTMLInputElement>` |
| | onChange (textarea) | `React.ChangeEvent<HTMLTextAreaElement>` |
| | onChange (select) | `React.ChangeEvent<HTMLSelectElement>` |
| | onSubmit | `React.FormEvent<HTMLFormElement>` |
| | onFocus, onBlur | `React.FocusEvent<HTMLElement>` |
| **Keyboard** | onKeyDown, onKeyUp, onKeyPress | `React.KeyboardEvent<HTMLElement>` |
| **Drag** | onDragStart, onDragEnd, onDrag | `React.DragEvent<HTMLElement>` |
| | onDragOver, onDrop, onDragEnter, onDragLeave | `React.DragEvent<HTMLElement>` |
| **Clipboard** | onCopy, onCut, onPaste | `React.ClipboardEvent<HTMLElement>` |
| **Touch** | onTouchStart, onTouchMove, onTouchEnd | `React.TouchEvent<HTMLElement>` |
| **Scroll** | onScroll | `React.UIEvent<HTMLElement>` |
| **Wheel** | onWheel | `React.WheelEvent<HTMLElement>` |
| **Animation** | onAnimationStart, onAnimationEnd | `React.AnimationEvent<HTMLElement>` |
| **Transition** | onTransitionEnd | `React.TransitionEvent<HTMLElement>` |

## Common Patterns

### Prevent Default

```typescript
// Form submission
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // Prevent page reload
  // Handle submit
};

// Link click
const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault(); // Prevent navigation
  // Custom handling
};
```

### Stop Propagation

```typescript
const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation(); // Don't trigger parent onClick
  // Handle click
};
```

### Accessing Event Properties

```typescript
// Mouse position
const handleClick = (e: React.MouseEvent) => {
  console.log(e.clientX, e.clientY); // Viewport coordinates
  console.log(e.pageX, e.pageY); // Page coordinates
  console.log(e.screenX, e.screenY); // Screen coordinates
};

// Input value
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  const name = e.target.name;
};

// Keyboard key
const handleKeyDown = (e: React.KeyboardEvent) => {
  console.log(e.key); // Key name: 'Enter', 'a', 'Escape'
  console.log(e.code); // Physical key: 'KeyA', 'Enter'
  console.log(e.keyCode); // Deprecated, use key instead
};
```

## Notes

### React Synthetic Events

React uses synthetic events (wrappers around native events):

```typescript
// ✅ Correct: React synthetic event
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e.currentTarget); // Always the button
  console.log(e.target); // Actual clicked element
};

// ❌ Wrong: Native event type
const handleClick = (e: MouseEvent) => {
  // This is the native browser event, not React's
};
```

### Generic Element Type

Replace `HTMLElement` with specific element:

```typescript
// Specific elements
React.MouseEvent<HTMLButtonElement>
React.MouseEvent<HTMLDivElement>
React.MouseEvent<HTMLAnchorElement>
React.ChangeEvent<HTMLInputElement>
React.ChangeEvent<HTMLTextAreaElement>
React.ChangeEvent<HTMLSelectElement>

// Generic (less type-safe)
React.MouseEvent<HTMLElement>
```

### Event Handler Naming

Follow convention: `handle` + `Element` + `EventName`

```typescript
// ✅ Good naming
handleButtonClick
handleFormSubmit
handleInputChange
handleUserNameChange

// ❌ Avoid
clickHandler
onClickHandler
buttonClickHandler
```
