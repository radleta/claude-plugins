# Template: forwardRef Component

**When to Use**: Exposing DOM refs to parent components, typically for input components or libraries.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not typing ref properly with forwardRef
- Using wrong ref type (HTMLDivElement vs HTMLInputElement, etc.)
- Not using useImperativeHandle when exposing custom methods
- Forgetting to forward ref to actual DOM element

## Template

```typescript
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Props for {{ComponentName}}
 */
interface {{ComponentName}}Props {
  {{propName}}: {{PropType}};
  {{onEvent}}?: ({{param}}: {{ParamType}}) => void;
}

/**
 * {{ComponentName}} with forwarded ref to {{element}} element
 */
export const {{ComponentName}} = forwardRef<
  {{HTMLElementType}}, // Ref type (e.g., HTMLInputElement, HTMLDivElement)
  {{ComponentName}}Props // Props type
>(function {{ComponentName}}({ {{propName}}, {{onEvent}} }, ref) {
  return (
    <{{element}}
      ref={ref} // Forward ref to element
      className="{{component-name}}"
      {{...otherProps}}
    >
      {/* Component content */}
    </{{element}}>
  );
});

// Display name for dev tools
{{ComponentName}}.displayName = '{{ComponentName}}';
```

## Template with useImperativeHandle

```typescript
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Custom ref handle interface
 * Defines methods exposed to parent
 */
interface {{ComponentName}}Handle {
  {{method1}}: () => void;
  {{method2}}: ({{param}}: {{ParamType}}) => {{ReturnType}};
  // Optionally expose DOM element
  get {{element}}(): {{HTMLElementType}} | null;
}

interface {{ComponentName}}Props {
  {{propName}}: {{PropType}};
}

/**
 * {{ComponentName}} with custom ref handle
 */
export const {{ComponentName}} = forwardRef<
  {{ComponentName}}Handle, // Custom ref handle type
  {{ComponentName}}Props
>(function {{ComponentName}}({ {{propName}} }, ref) {
  // Internal ref to actual DOM element
  const {{element}}Ref = useRef<{{HTMLElementType}}>(null);

  // Expose custom methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      {{method1}}: () => {
        // Method implementation
        {{element}}Ref.current?.focus();
      },

      {{method2}}: ({{param}}: {{ParamType}}) => {
        // Method implementation
        return {{returnValue}};
      },

      // Expose DOM element if needed
      get {{element}}() {
        return {{element}}Ref.current;
      },
    }),
    [/* dependencies */]
  );

  return (
    <{{element}}
      ref={{element}}Ref}
      className="{{component-name}}"
    >
      {/* Component content */}
    </{{element}}>
  );
});

{{ComponentName}}.displayName = '{{ComponentName}}';
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with actual component name
- [ ] Use correct HTML element type for ref (HTMLInputElement, HTMLButtonElement, etc.)
- [ ] Forward ref to actual DOM element
- [ ] Add displayName for better debugging
- [ ] Use useImperativeHandle if exposing custom methods
- [ ] Define custom handle interface if using useImperativeHandle
- [ ] Include dependencies array in useImperativeHandle

## Related

- Rule: @rules/hooks-rules.md (useImperativeHandle best practices)
- Rule: @rules/typescript-essentials.md (typing refs and forwardRef)
- Decision: @decision-trees/effect-usage.md (when to use refs vs effects)

## Example: Input with forwardRef

```typescript
import React, { forwardRef } from 'react';

interface InputProps {
  label: string;
  error?: string;
  type?: 'text' | 'email' | 'password';
}

/**
 * Input - Reusable input component with ref forwarding
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, type = 'text' }, ref) {
    return (
      <div className="input-wrapper">
        <label className="input-label">
          {label}
        </label>

        <input
          ref={ref} // Forward ref to input element
          type={type}
          className={`input ${error ? 'input--error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? 'input-error' : undefined}
        />

        {error && (
          <span id="input-error" className="input-error">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Usage in parent component
 */
function LoginForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Access input values via ref
    const email = emailRef.current?.value;
    const password = passwordRef.current?.value;

    console.log({ email, password });
  };

  useEffect(() => {
    // Auto-focus first input
    emailRef.current?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <Input ref={emailRef} label="Email" type="email" />
      <Input ref={passwordRef} label="Password" type="password" />
      <button type="submit">Login</button>
    </form>
  );
}
```

## Example: Custom Handle with useImperativeHandle

```typescript
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

/**
 * Custom ref handle for VideoPlayer
 */
interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface VideoPlayerProps {
  src: string;
  onEnded?: () => void;
}

/**
 * VideoPlayer - Exposes playback controls via ref
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ src, onEnded }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.play();
          setIsPlaying(true);
        },

        pause: () => {
          videoRef.current?.pause();
          setIsPlaying(false);
        },

        seek: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },

        getCurrentTime: () => {
          return videoRef.current?.currentTime ?? 0;
        },

        getDuration: () => {
          return videoRef.current?.duration ?? 0;
        },
      }),
      [] // No dependencies - methods are stable
    );

    return (
      <div className="video-player">
        <video
          ref={videoRef}
          src={src}
          onEnded={onEnded}
          className="video-player__video"
        />

        <div className="video-player__status">
          {isPlaying ? 'Playing' : 'Paused'}
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

/**
 * Usage with custom handle
 */
function VideoContainer() {
  const playerRef = useRef<VideoPlayerHandle>(null);

  const handlePlayClick = () => {
    playerRef.current?.play();
  };

  const handlePauseClick = () => {
    playerRef.current?.pause();
  };

  const handleSeekTo30s = () => {
    playerRef.current?.seek(30);
  };

  const logCurrentTime = () => {
    const time = playerRef.current?.getCurrentTime();
    console.log('Current time:', time);
  };

  return (
    <div>
      <VideoPlayer
        ref={playerRef}
        src="/video.mp4"
        onEnded={() => console.log('Video ended')}
      />

      <div className="controls">
        <button onClick={handlePlayClick}>Play</button>
        <button onClick={handlePauseClick}>Pause</button>
        <button onClick={handleSeekTo30s}>Skip to 30s</button>
        <button onClick={logCurrentTime}>Log Time</button>
      </div>
    </div>
  );
}
```

## Notes

### HTML Element Types

Use correct type for ref:

```typescript
// Input elements
HTMLInputElement

// Button elements
HTMLButtonElement

// Div elements
HTMLDivElement

// Form elements
HTMLFormElement

// Textarea
HTMLTextAreaElement

// Select
HTMLSelectElement

// Video/Audio
HTMLVideoElement, HTMLAudioElement

// Canvas
HTMLCanvasElement
```

### forwardRef Syntax

```typescript
// ✅ Correct forwardRef usage
export const MyComponent = forwardRef<RefType, PropsType>(
  function MyComponent(props, ref) {
    return <div ref={ref}>...</div>;
  }
);

// Add displayName for debugging
MyComponent.displayName = 'MyComponent';

// ❌ Wrong - missing types
export const MyComponent = forwardRef((props, ref) => {
  return <div ref={ref}>...</div>;
});
```

### When to Use forwardRef

**Use forwardRef when:**
- Creating reusable input/button/form components
- Building component libraries
- Parent needs to control focus, scroll, or measurements
- Wrapping native elements

**Use useImperativeHandle when:**
- Exposing custom methods (not just DOM element)
- Want to limit what parent can access
- Providing component-specific API

**Don't use refs for:**
- Passing data (use props)
- Replacing state
- Accessing child component state (lift state up instead)

### Ref Callback Alternative

Sometimes callback ref is cleaner than forwardRef:

```typescript
interface MyComponentProps {
  onMount?: (element: HTMLDivElement) => void;
}

function MyComponent({ onMount }: MyComponentProps) {
  return (
    <div ref={onMount}>
      Content
    </div>
  );
}

// Usage
<MyComponent onMount={(element) => {
  element.focus();
}} />
```
