# Template: Basic Unit Spec

**When to Use**: Testing Ruby classes, modules, service objects, pure logic without Rails dependencies or external services.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not organizing tests with proper describe/context/it hierarchy
- Using generic test descriptions like "it works" instead of behavior descriptions
- Not testing edge cases (nil, empty, boundary values)
- Missing before blocks to DRY up test setup
- Not using let/let! appropriately (let is lazy, let! is eager)
- Mixing subject and explicit variable names inconsistently
- Not using shared examples when testing similar behavior across classes

## Template

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe {{ClassName}} do
  # Use subject when testing a single instance throughout
  subject(:{{instance_name}}) { described_class.new({{constructor_args}}) }

  # Use let for lazy-loaded test data
  let(:{{variable_name}}) { {{value}} }
  let(:{{another_variable}}) { {{FactoryBot.create(:factory_name)}} }

  # Use let! when you need the variable created immediately
  let!(:{{eager_variable}}) { {{value_that_must_exist}} }

  describe '#{{method_name}}' do
    context 'when {{condition_description}}' do
      let(:{{context_specific_variable}}) { {{value}} }

      it '{{describes_expected_behavior}}' do
        result = {{instance_name}}.{{method_name}}({{arguments}})

        expect(result).to eq({{expected_value}})
      end

      it '{{describes_another_behavior}}' do
        expect { {{instance_name}}.{{method_name}}({{arguments}}) }
          .to change { {{observable_state}} }
          .from({{old_value}})
          .to({{new_value}})
      end

      it '{{describes_side_effect}}' do
        {{instance_name}}.{{method_name}}({{arguments}})

        expect({{instance_name}}.{{state_attribute}}).to eq({{expected_state}})
      end
    end

    context 'when {{different_condition}}' do
      let(:{{context_specific_variable}}) { {{different_value}} }

      it '{{describes_different_behavior}}' do
        result = {{instance_name}}.{{method_name}}({{arguments}})

        expect(result).to be_nil
      end

      it 'raises {{ErrorClass}}' do
        expect { {{instance_name}}.{{method_name}}({{arguments}}) }
          .to raise_error({{ErrorClass}}, {{expected_error_message}})
      end
    end

    context 'with edge cases' do
      it 'handles nil input' do
        result = {{instance_name}}.{{method_name}}(nil)

        expect(result).to eq({{expected_for_nil}})
      end

      it 'handles empty input' do
        result = {{instance_name}}.{{method_name}}('')

        expect(result).to eq({{expected_for_empty}})
      end

      it 'handles boundary values' do
        result = {{instance_name}}.{{method_name}}({{boundary_value}})

        expect(result).to eq({{expected_for_boundary}})
      end
    end
  end

  describe '#{{another_method}}' do
    it '{{describes_behavior}}' do
      expect({{instance_name}}.{{another_method}}).to be_truthy
    end

    it '{{describes_predicate_behavior}}' do
      expect({{instance_name}}).to be_{{predicate_name}}
    end
  end

  describe '.{{class_method}}' do
    it '{{describes_class_method_behavior}}' do
      result = described_class.{{class_method}}({{arguments}})

      expect(result).to be_a({{ExpectedClass}})
    end
  end

  # Use shared examples for common behavior
  it_behaves_like '{{shared_example_name}}' do
    let(:{{shared_variable}}) { {{value}} }
  end
end
```

## Configuration Files

### .rspec

```
--require spec_helper
--color
--format documentation
--order random
```

### spec_helper.rb

```ruby
# frozen_string_literal: true

RSpec.configure do |config|
  # Enable flags like --only-failures and --next-failure
  config.example_status_persistence_file_path = '.rspec_status'

  # Disable RSpec exposing methods globally on `Module` and `main`
  config.disable_monkey_patching!

  # Use expect syntax only (not should)
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end

  # Random order
  config.order = :random
  Kernel.srand config.seed
end
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}` with the class under test (PascalCase)
- [ ] Replace `{{instance_name}}` with a descriptive variable name (snake_case)
- [ ] Replace `{{method_name}}` with actual method names
- [ ] Update context descriptions to describe specific conditions
- [ ] Write behavior-focused it descriptions (not implementation details)
- [ ] Add edge cases specific to your method's input domain
- [ ] Use appropriate matchers (eq, be, include, match, etc.)
- [ ] Remove shared_examples if not using them
- [ ] Add custom matchers if they improve readability

## Related

- Rule: @rules/rspec-best-practices.md
- Decision: @decision-trees/test-organization.md
- Template: @templates/rspec/mock_spec.rb (when testing dependencies)

## Example: Calculator Service

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Calculator do
  subject(:calculator) { described_class.new }

  describe '#add' do
    context 'when both numbers are positive' do
      it 'returns the sum' do
        result = calculator.add(5, 3)

        expect(result).to eq(8)
      end
    end

    context 'when one number is negative' do
      it 'returns the correct sum' do
        result = calculator.add(5, -3)

        expect(result).to eq(2)
      end
    end

    context 'with edge cases' do
      it 'handles zero' do
        result = calculator.add(0, 5)

        expect(result).to eq(5)
      end

      it 'handles very large numbers' do
        result = calculator.add(Float::MAX, 1)

        expect(result).to be > Float::MAX
      end
    end
  end

  describe '#divide' do
    context 'when divisor is non-zero' do
      it 'returns the quotient' do
        result = calculator.divide(10, 2)

        expect(result).to eq(5.0)
      end
    end

    context 'when divisor is zero' do
      it 'raises ZeroDivisionError' do
        expect { calculator.divide(10, 0) }
          .to raise_error(ZeroDivisionError, 'divided by 0')
      end
    end

    context 'with edge cases' do
      it 'handles division resulting in infinity' do
        result = calculator.divide(1.0, 0.0)

        expect(result).to eq(Float::INFINITY)
      end

      it 'handles negative divisor' do
        result = calculator.divide(10, -2)

        expect(result).to eq(-5.0)
      end
    end
  end

  describe '#memory_add' do
    let(:value) { 10 }

    it 'adds to memory' do
      expect { calculator.memory_add(value) }
        .to change { calculator.memory }
        .from(0)
        .to(10)
    end

    it 'accumulates multiple additions' do
      calculator.memory_add(5)
      calculator.memory_add(3)

      expect(calculator.memory).to eq(8)
    end
  end

  describe '#clear_memory' do
    before do
      calculator.memory_add(100)
    end

    it 'resets memory to zero' do
      expect { calculator.clear_memory }
        .to change { calculator.memory }
        .from(100)
        .to(0)
    end
  end

  describe '.parse_expression' do
    it 'parses addition expression' do
      result = described_class.parse_expression('2 + 3')

      expect(result).to eq({ operation: :add, operands: [2, 3] })
    end

    it 'handles whitespace variations' do
      result = described_class.parse_expression('2+3')

      expect(result[:operands]).to eq([2, 3])
    end

    it 'raises ArgumentError for invalid expressions' do
      expect { described_class.parse_expression('invalid') }
        .to raise_error(ArgumentError, /invalid expression/)
    end
  end
end
```

## Notes

### Describe/Context/It Hierarchy

Structure tests to tell a story:
- `describe`: Groups tests for a method or feature
- `context`: Describes a specific condition or state
- `it`: Describes a single expected behavior

```ruby
describe '#method_name' do          # What are we testing?
  context 'when user is logged in' do  # Under what conditions?
    it 'returns user data' do          # What should happen?
```

### Subject vs Let

**Use subject when**:
- Testing a single instance throughout the spec
- The instance is the primary focus
- You want to use `is_expected.to` syntax

**Use let when**:
- You need multiple test objects
- You want lazy loading (only created when referenced)
- Setting up test data or dependencies

### Matcher Selection

Choose the right matcher for readability:
```ruby
expect(value).to eq(5)        # Equality
expect(value).to be > 5       # Comparison
expect(value).to be_nil       # Identity
expect(array).to include(5)   # Collection membership
expect(string).to match(/\d+/) # Pattern matching
expect(object).to be_a(Class) # Type checking
expect(object).to respond_to(:method) # Duck typing
expect { block }.to raise_error(Error) # Exceptions
expect { block }.to change { state }.from(x).to(y) # State changes
```

### Edge Cases to Test

Always consider:
- **Nil/null values**: What happens with missing data?
- **Empty collections**: [], {}, ''
- **Boundary values**: 0, -1, MAX, MIN
- **Invalid types**: String when expecting Integer
- **Special characters**: Unicode, newlines, quotes
- **Large inputs**: Performance with 10,000 items

### Before Blocks

Use for setup that applies to all tests in scope:
```ruby
before do           # Runs before each test
  @user = User.new
end

before(:all) do    # Runs once before all tests (use sparingly)
  @shared_data = expensive_setup
end
```

### One Assertion Per Test?

**Not a hard rule**. Group related assertions:
```ruby
# ✅ Good: Related assertions about the same result
it 'creates a valid user' do
  user = User.create(name: 'John')

  expect(user).to be_persisted
  expect(user.name).to eq('John')
  expect(user.created_at).to be_present
end

# ❌ Bad: Unrelated assertions
it 'handles everything' do
  expect(service.process).to be_truthy
  expect(User.count).to eq(5)
  expect(mailer).to have_received(:deliver)
end
```
