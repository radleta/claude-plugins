# Template: Controlled Form Component

**When to Use**: Building forms where React controls input values (single source of truth in state).

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Using `any` for event types instead of proper React event types
- Not preventing default form submission
- Forgetting to call preventDefault on form submit
- Using uncontrolled inputs (no value prop)
- Not typing form data interface
- Poor validation implementation
- Not handling all input types (text, email, select, checkbox, radio)

## Template

```typescript
import React, { useState, FormEvent, ChangeEvent } from 'react';

/**
 * Form data shape
 */
interface {{FormData}} {
  {{textField}}: string;
  {{emailField}}: string;
  {{numberField}}: number;
  {{selectField}}: string;
  {{checkboxField}}: boolean;
  {{textareaField}}: string;
}

/**
 * Validation errors shape
 */
interface {{ValidationErrors}} {
  {{textField}}?: string;
  {{emailField}}?: string;
  {{numberField}}?: string;
  {{selectField}}?: string;
  {{checkboxField}}?: string;
  {{textareaField}}?: string;
}

interface {{FormComponentName}}Props {
  /**
   * Initial form values
   */
  initialValues?: Partial<{{FormData}}>;

  /**
   * Callback when form is successfully submitted
   */
  onSubmit?: (data: {{FormData}}) => Promise<void> | void;

  /**
   * Callback when form is cancelled
   */
  onCancel?: () => void;
}

/**
 * {{FormComponentName}} - {{Description}}
 */
export function {{FormComponentName}}({
  initialValues = {},
  onSubmit,
  onCancel,
}: {{FormComponentName}}Props) {
  // Form data state
  const [formData, setFormData] = useState<{{FormData}}>({
    {{textField}}: initialValues.{{textField}} || '',
    {{emailField}}: initialValues.{{emailField}} || '',
    {{numberField}}: initialValues.{{numberField}} || 0,
    {{selectField}}: initialValues.{{selectField}} || '',
    {{checkboxField}}: initialValues.{{checkboxField}} || false,
    {{textareaField}}: initialValues.{{textareaField}} || '',
  });

  // Validation errors state
  const [errors, setErrors] = useState<{{ValidationErrors}}>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Touched fields (for validation display)
  const [touched, setTouched] = useState<Set<keyof {{FormData}}>>(new Set());

  /**
   * Handle text input change
   */
  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Handle textarea change
   */
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Handle select change
   */
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Handle checkbox change
   */
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  /**
   * Handle number input change
   */
  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  /**
   * Handle field blur (mark as touched)
   */
  const handleBlur = (fieldName: keyof {{FormData}}) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  /**
   * Validate form data
   */
  const validate = (data: {{FormData}}): {{ValidationErrors}} => {
    const newErrors: {{ValidationErrors}} = {};

    // Text field validation
    if (!data.{{textField}}.trim()) {
      newErrors.{{textField}} = '{{Field name}} is required';
    } else if (data.{{textField}}.length < 3) {
      newErrors.{{textField}} = '{{Field name}} must be at least 3 characters';
    }

    // Email validation
    if (!data.{{emailField}}.trim()) {
      newErrors.{{emailField}} = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.{{emailField}})) {
      newErrors.{{emailField}} = 'Invalid email format';
    }

    // Number validation
    if (data.{{numberField}} < 0) {
      newErrors.{{numberField}} = 'Must be a positive number';
    }

    // Select validation
    if (!data.{{selectField}}) {
      newErrors.{{selectField}} = 'Please select an option';
    }

    // Checkbox validation
    if (!data.{{checkboxField}}) {
      newErrors.{{checkboxField}} = 'You must accept the terms';
    }

    // Textarea validation
    if (!data.{{textareaField}}.trim()) {
      newErrors.{{textareaField}} = '{{Field name}} is required';
    } else if (data.{{textareaField}}.length > 500) {
      newErrors.{{textareaField}} = 'Must be 500 characters or less';
    }

    return newErrors;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    // CRITICAL: Prevent default form submission
    e.preventDefault();

    // Validate all fields
    const validationErrors = validate(formData);
    setErrors(validationErrors);

    // Mark all fields as touched
    setTouched(new Set(Object.keys(formData) as Array<keyof {{FormData}}>));

    // If there are errors, don't submit
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Submit form
    setIsSubmitting(true);

    try {
      await onSubmit?.(formData);

      // Reset form on success (optional)
      // setFormData({ ... initialValues });
      // setTouched(new Set());
    } catch (error) {
      console.error('Form submission error:', error);
      // Handle submission error
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Show error only if field is touched
   */
  const getFieldError = (fieldName: keyof {{FormData}}): string | undefined => {
    return touched.has(fieldName) ? errors[fieldName] : undefined;
  };

  return (
    <form className="{{form-class-name}}" onSubmit={handleSubmit}>
      {/* Text Input */}
      <div className="form-group">
        <label htmlFor="{{textField}}">
          {{Field Label}} *
        </label>
        <input
          id="{{textField}}"
          name="{{textField}}"
          type="text"
          value={formData.{{textField}}}
          onChange={handleTextChange}
          onBlur={() => handleBlur('{{textField}}')}
          disabled={isSubmitting}
          aria-invalid={!!getFieldError('{{textField}}')}
          aria-describedby={getFieldError('{{textField}}') ? '{{textField}}-error' : undefined}
        />
        {getFieldError('{{textField}}') && (
          <span id="{{textField}}-error" className="error">
            {getFieldError('{{textField}}')}
          </span>
        )}
      </div>

      {/* Email Input */}
      <div className="form-group">
        <label htmlFor="{{emailField}}">
          Email *
        </label>
        <input
          id="{{emailField}}"
          name="{{emailField}}"
          type="email"
          value={formData.{{emailField}}}
          onChange={handleTextChange}
          onBlur={() => handleBlur('{{emailField}}')}
          disabled={isSubmitting}
          aria-invalid={!!getFieldError('{{emailField}}')}
          aria-describedby={getFieldError('{{emailField}}') ? '{{emailField}}-error' : undefined}
        />
        {getFieldError('{{emailField}}') && (
          <span id="{{emailField}}-error" className="error">
            {getFieldError('{{emailField}}')}
          </span>
        )}
      </div>

      {/* Number Input */}
      <div className="form-group">
        <label htmlFor="{{numberField}}">
          {{Number Label}}
        </label>
        <input
          id="{{numberField}}"
          name="{{numberField}}"
          type="number"
          value={formData.{{numberField}}}
          onChange={handleNumberChange}
          onBlur={() => handleBlur('{{numberField}}')}
          disabled={isSubmitting}
        />
        {getFieldError('{{numberField}}') && (
          <span className="error">
            {getFieldError('{{numberField}}')}
          </span>
        )}
      </div>

      {/* Select Dropdown */}
      <div className="form-group">
        <label htmlFor="{{selectField}}">
          {{Select Label}} *
        </label>
        <select
          id="{{selectField}}"
          name="{{selectField}}"
          value={formData.{{selectField}}}
          onChange={handleSelectChange}
          onBlur={() => handleBlur('{{selectField}}')}
          disabled={isSubmitting}
        >
          <option value="">Select an option</option>
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
          <option value="option3">Option 3</option>
        </select>
        {getFieldError('{{selectField}}') && (
          <span className="error">
            {getFieldError('{{selectField}}')}
          </span>
        )}
      </div>

      {/* Textarea */}
      <div className="form-group">
        <label htmlFor="{{textareaField}}">
          {{Textarea Label}} *
        </label>
        <textarea
          id="{{textareaField}}"
          name="{{textareaField}}"
          value={formData.{{textareaField}}}
          onChange={handleTextareaChange}
          onBlur={() => handleBlur('{{textareaField}}')}
          disabled={isSubmitting}
          rows={5}
        />
        {getFieldError('{{textareaField}}') && (
          <span className="error">
            {getFieldError('{{textareaField}}')}
          </span>
        )}
      </div>

      {/* Checkbox */}
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            name="{{checkboxField}}"
            checked={formData.{{checkboxField}}}
            onChange={handleCheckboxChange}
            onBlur={() => handleBlur('{{checkboxField}}')}
            disabled={isSubmitting}
          />
          {{Checkbox Label}} *
        </label>
        {getFieldError('{{checkboxField}}') && (
          <span className="error">
            {getFieldError('{{checkboxField}}')}
          </span>
        )}
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
```

## Adaptation Rules

- [ ] Replace `{{FormComponentName}}`, `{{FormData}}` with actual names
- [ ] Define all form fields in `{{FormData}}` interface
- [ ] Use correct event types: `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`, etc.
- [ ] ALWAYS call `e.preventDefault()` in submit handler
- [ ] Implement validation logic in `validate` function
- [ ] Use controlled inputs (value prop + onChange handler)
- [ ] Handle all input types you need (remove unused ones)
- [ ] Show errors only for touched fields
- [ ] Add ARIA attributes for accessibility
- [ ] Disable inputs during submission

## Related

- Rule: @rules/typescript-essentials.md (event types for forms)
- Rule: @rules/immutable-updates.md (form state updates)
- Template: @templates/event-handlers.tsx (event type reference)

## Notes

### Controlled vs Uncontrolled

**Controlled (✅ Recommended):**
```typescript
// React controls the value
<input value={name} onChange={e => setName(e.target.value)} />
```

**Uncontrolled (❌ Avoid in most cases):**
```typescript
// DOM controls the value
<input ref={inputRef} />
```

### Event Types

```typescript
// Text input, email, number
ChangeEvent<HTMLInputElement>

// Textarea
ChangeEvent<HTMLTextAreaElement>

// Select
ChangeEvent<HTMLSelectElement>

// Form submission
FormEvent<HTMLFormElement>
```

### preventDefault is Critical

```typescript
// ❌ Missing preventDefault causes page reload
const handleSubmit = (e: FormEvent) => {
  // Page reloads here!
  submitData();
};

// ✅ Prevents default browser form submission
const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // CRITICAL
  submitData();
};
```
