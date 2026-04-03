# Template: Parametrized Spec

**When to Use**: Testing the same logic with multiple input combinations, table-driven tests, boundary value testing, cross-platform testing, testing multiple configurations.

**Complexity**: Low

**Common Mistakes Agents Make**:
- Not using shared_examples effectively for DRY tests
- Creating unclear parametrized test descriptions
- Mixing unrelated test cases in the same parametrized block
- Not providing context-specific descriptions for each parameter set
- Using overly complex parametrization that hurts readability
- Not testing the right combinations (missing edge cases)
- Making parameter tables too large and unmaintainable

## Template

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe {{ClassName}} do
  # Pattern 1: Using shared_examples with different contexts
  shared_examples 'a {{behavior_description}}' do |{{param_name}}|
    it '{{describes_expected_behavior}}' do
      result = described_class.{{method_name}}({{param_name}})

      expect(result).to eq({{expected_result}})
    end

    it '{{describes_another_behavior}}' do
      expect(described_class.{{method_name}}({{param_name}})).to be_{{predicate}}
    end
  end

  describe '#{{method_name}}' do
    context 'with {{scenario_1}}' do
      it_behaves_like 'a {{behavior_description}}', {{value_1}}
    end

    context 'with {{scenario_2}}' do
      it_behaves_like 'a {{behavior_description}}', {{value_2}}
    end

    context 'with {{scenario_3}}' do
      it_behaves_like 'a {{behavior_description}}', {{value_3}}
    end
  end

  # Pattern 2: Using each with parameter arrays
  describe '#{{another_method}}' do
    [
      { input: {{input_1}}, expected: {{output_1}}, description: '{{case_1}}' },
      { input: {{input_2}}, expected: {{output_2}}, description: '{{case_2}}' },
      { input: {{input_3}}, expected: {{output_3}}, description: '{{case_3}}' },
      { input: {{input_4}}, expected: {{output_4}}, description: '{{case_4}}' }
    ].each do |test_case|
      context "when #{test_case[:description]}" do
        it "returns #{test_case[:expected]}" do
          result = described_class.{{another_method}}(test_case[:input])

          expect(result).to eq(test_case[:expected])
        end
      end
    end
  end

  # Pattern 3: Boundary value testing
  describe 'boundary value testing' do
    {
      'minimum value' => { input: {{min_value}}, expected: {{min_expected}} },
      'maximum value' => { input: {{max_value}}, expected: {{max_expected}} },
      'zero' => { input: 0, expected: {{zero_expected}} },
      'negative' => { input: -1, expected: {{negative_expected}} },
      'just below minimum' => { input: {{below_min}}, expected: {{error_expected}} }
    }.each do |description, test_data|
      it "handles #{description}" do
        if test_data[:expected] == :error
          expect { described_class.{{method}}(test_data[:input]) }
            .to raise_error({{ErrorClass}})
        else
          result = described_class.{{method}}(test_data[:input])
          expect(result).to eq(test_data[:expected])
        end
      end
    end
  end

  # Pattern 4: Shared context with parameters
  shared_context 'with {{context_name}}' do |{{param}}|
    let(:{{variable_name}}) { {{param}} }
    let(:{{derived_variable}}) { {{transform(param)}} }

    before do
      {{setup_code}}
    end
  end

  describe 'using shared context' do
    [{{value_1}}, {{value_2}}, {{value_3}}].each do |{{param}}|
      context "with #{{{param}}}" do
        include_context 'with {{context_name}}', {{param}}

        it '{{behavior}}' do
          expect({{variable_name}}).to eq({{param}})
        end
      end
    end
  end

  # Pattern 5: Combination testing (multiple parameters)
  describe 'multiple parameter combinations' do
    {
      '{{combo_1_desc}}' => { {{param_1}}: {{val_1}}, {{param_2}}: {{val_2}}, expected: {{result_1}} },
      '{{combo_2_desc}}' => { {{param_1}}: {{val_3}}, {{param_2}}: {{val_4}}, expected: {{result_2}} },
      '{{combo_3_desc}}' => { {{param_1}}: {{val_5}}, {{param_2}}: {{val_6}}, expected: {{result_3}} }
    }.each do |description, params|
      context description do
        it "returns #{params[:expected]}" do
          result = described_class.{{method}}(
            params[:{{param_1}}],
            params[:{{param_2}}]
          )

          expect(result).to eq(params[:expected])
        end
      end
    end
  end

  # Pattern 6: Shared examples with multiple parameters
  shared_examples 'validates {{validation_type}}' do
    it 'accepts valid input' do
      expect({{validator}}.valid?(valid_input)).to be true
    end

    it 'rejects invalid input' do
      expect({{validator}}.valid?(invalid_input)).to be false
    end

    it 'provides error message for invalid input' do
      {{validator}}.valid?(invalid_input)

      expect({{validator}}.errors).to include(expected_error)
    end
  end

  describe '{{validator_class}}' do
    describe 'email validation' do
      it_behaves_like 'validates {{validation_type}}' do
        let(:{{validator}}) { described_class.new(:email) }
        let(:valid_input) { 'test@example.com' }
        let(:invalid_input) { 'invalid-email' }
        let(:expected_error) { 'must be a valid email' }
      end
    end

    describe 'phone validation' do
      it_behaves_like 'validates {{validation_type}}' do
        let(:{{validator}}) { described_class.new(:phone) }
        let(:valid_input) { '+1-555-123-4567' }
        let(:invalid_input) { '123' }
        let(:expected_error) { 'must be a valid phone number' }
      end
    end

    describe 'URL validation' do
      it_behaves_like 'validates {{validation_type}}' do
        let(:{{validator}}) { described_class.new(:url) }
        let(:valid_input) { 'https://example.com' }
        let(:invalid_input) { 'not-a-url' }
        let(:expected_error) { 'must be a valid URL' }
      end
    end
  end

  # Pattern 7: Error case parametrization
  describe 'error handling' do
    [
      { input: nil, error: ArgumentError, message: 'cannot be nil' },
      { input: '', error: ArgumentError, message: 'cannot be empty' },
      { input: '   ', error: ArgumentError, message: 'cannot be blank' },
      { input: 'x' * 1000, error: ArgumentError, message: 'too long' }
    ].each do |test_case|
      it "raises #{test_case[:error]} for input: #{test_case[:input].inspect}" do
        expect { described_class.{{method}}(test_case[:input]) }
          .to raise_error(test_case[:error], /#{test_case[:message]}/)
      end
    end
  end

  # Pattern 8: Type testing with parametrization
  describe 'type compatibility' do
    {
      'String' => { input: 'test', expected: 'TEST' },
      'Symbol' => { input: :test, expected: 'TEST' },
      'Integer (to_s)' => { input: 123, expected: '123' },
      'Array (join)' => { input: %w[a b c], expected: 'ABC' }
    }.each do |type, test_data|
      it "handles #{type} input" do
        result = described_class.{{method}}(test_data[:input])

        expect(result).to eq(test_data[:expected])
      end
    end
  end

  # Pattern 9: State transition testing
  shared_examples 'transitions from {{from_state}} to {{to_state}}' do
    it 'changes state correctly' do
      {{object}}.{{current_state}} = from_state

      {{object}}.{{transition_method}}

      expect({{object}}.{{current_state}}).to eq(to_state)
    end

    it 'triggers expected callbacks' do
      {{object}}.{{current_state}} = from_state

      expect({{callback_tracker}}).to receive(:on_transition)
        .with(from_state, to_state)

      {{object}}.{{transition_method}}
    end
  end

  describe 'state transitions' do
    let(:{{object}}) { described_class.new }
    let(:{{callback_tracker}}) { instance_double({{TrackerClass}}) }

    [
      { from: :draft, to: :published, method: :publish },
      { from: :published, to: :archived, method: :archive },
      { from: :archived, to: :draft, method: :unarchive }
    ].each do |transition|
      context "#{transition[:from]} -> #{transition[:to]}" do
        it_behaves_like 'transitions from {{from_state}} to {{to_state}}' do
          let(:from_state) { transition[:from] }
          let(:to_state) { transition[:to] }
          let(:transition_method) { transition[:method] }
        end
      end
    end
  end

  # Pattern 10: Matrix testing (all combinations)
  describe 'permission matrix' do
    users = [:admin, :moderator, :user, :guest]
    actions = [:read, :write, :delete]

    users.each do |user_role|
      actions.each do |action|
        context "#{user_role} attempting #{action}" do
          let(:user) { build_user(role: user_role) }
          let(:expected) { permission_matrix[user_role][action] }

          it "#{expected ? 'allows' : 'denies'} access" do
            result = described_class.authorized?(user, action)

            expect(result).to eq(expected)
          end
        end
      end
    end
  end

  # Helper for permission matrix
  def permission_matrix
    {
      admin: { read: true, write: true, delete: true },
      moderator: { read: true, write: true, delete: false },
      user: { read: true, write: false, delete: false },
      guest: { read: true, write: false, delete: false }
    }
  end
end
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}`, `{{method_name}}` with actual names
- [ ] Choose appropriate parametrization pattern for your use case
- [ ] Create descriptive parameter names that explain the test case
- [ ] Group related test cases together
- [ ] Use shared_examples for complex repeated behavior
- [ ] Use simple .each loops for simple parameter variations
- [ ] Include edge cases and boundary values in parameters
- [ ] Make parameter descriptions clear and specific
- [ ] Keep parameter tables readable (consider extracting to methods)
- [ ] Test error cases with parametrized inputs

## Related

- Rule: @rules/parametrized-testing.md
- Template: @templates/rspec/basic_unit_spec.rb
- Decision: @decision-trees/test-parametrization.md

## Example: Calculator with Multiple Operations

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Calculator do
  describe 'basic arithmetic' do
    [
      { operation: :add, a: 5, b: 3, expected: 8, description: 'positive numbers' },
      { operation: :add, a: -5, b: 3, expected: -2, description: 'negative and positive' },
      { operation: :add, a: 0, b: 0, expected: 0, description: 'zeros' },
      { operation: :subtract, a: 10, b: 3, expected: 7, description: 'subtraction' },
      { operation: :multiply, a: 4, b: 5, expected: 20, description: 'multiplication' },
      { operation: :divide, a: 20, b: 4, expected: 5.0, description: 'division' }
    ].each do |test_case|
      it "#{test_case[:operation]} with #{test_case[:description]}" do
        result = described_class.new.send(
          test_case[:operation],
          test_case[:a],
          test_case[:b]
        )

        expect(result).to eq(test_case[:expected])
      end
    end
  end

  describe 'boundary values' do
    {
      'maximum safe integer' => { input: 2**53 - 1, valid: true },
      'above maximum' => { input: 2**53, valid: false },
      'minimum safe integer' => { input: -(2**53 - 1), valid: true },
      'below minimum' => { input: -(2**53), valid: false }
    }.each do |description, test_data|
      context "with #{description}" do
        if test_data[:valid]
          it 'accepts the value' do
            calc = described_class.new
            expect { calc.add(test_data[:input], 0) }.not_to raise_error
          end
        else
          it 'rejects the value' do
            calc = described_class.new
            expect { calc.add(test_data[:input], 0) }
              .to raise_error(ArgumentError, /out of range/)
          end
        end
      end
    end
  end

  shared_examples 'a commutative operation' do
    it 'returns same result regardless of order' do
      result1 = subject.send(operation, a, b)
      result2 = subject.send(operation, b, a)

      expect(result1).to eq(result2)
    end
  end

  describe 'commutative operations' do
    subject { described_class.new }
    let(:a) { 7 }
    let(:b) { 3 }

    context 'addition' do
      it_behaves_like 'a commutative operation' do
        let(:operation) { :add }
      end
    end

    context 'multiplication' do
      it_behaves_like 'a commutative operation' do
        let(:operation) { :multiply }
      end
    end
  end

  describe 'division edge cases' do
    subject { described_class.new }

    [
      { dividend: 10, divisor: 0, error: ZeroDivisionError },
      { dividend: 0, divisor: 0, error: ZeroDivisionError },
      { dividend: Float::INFINITY, divisor: 1, error: ArgumentError },
      { dividend: Float::NAN, divisor: 1, error: ArgumentError }
    ].each do |test_case|
      it "raises #{test_case[:error]} for #{test_case[:dividend]} / #{test_case[:divisor]}" do
        expect { subject.divide(test_case[:dividend], test_case[:divisor]) }
          .to raise_error(test_case[:error])
      end
    end
  end

  describe 'cross-platform number parsing' do
    {
      'US format' => { input: '1,234.56', locale: :en_US, expected: 1234.56 },
      'EU format' => { input: '1.234,56', locale: :de_DE, expected: 1234.56 },
      'FR format' => { input: '1 234,56', locale: :fr_FR, expected: 1234.56 },
      'scientific' => { input: '1.23e3', locale: :en_US, expected: 1230.0 }
    }.each do |description, test_data|
      it "parses #{description}" do
        result = described_class.parse_number(
          test_data[:input],
          locale: test_data[:locale]
        )

        expect(result).to eq(test_data[:expected])
      end
    end
  end
end

RSpec.describe StringValidator do
  shared_examples 'validates string constraints' do
    it 'accepts valid input' do
      expect(subject.valid?(valid_input)).to be true
    end

    it 'rejects too short input' do
      expect(subject.valid?(too_short)).to be false
      expect(subject.errors).to include(/too short/)
    end

    it 'rejects too long input' do
      expect(subject.valid?(too_long)).to be false
      expect(subject.errors).to include(/too long/)
    end

    it 'rejects invalid format' do
      expect(subject.valid?(invalid_format)).to be false
      expect(subject.errors).to include(/invalid format/)
    end
  end

  describe 'username validation' do
    subject { described_class.new(type: :username) }

    it_behaves_like 'validates string constraints' do
      let(:valid_input) { 'user123' }
      let(:too_short) { 'ab' }
      let(:too_long) { 'a' * 51 }
      let(:invalid_format) { 'user@123' }
    end
  end

  describe 'password validation' do
    subject { described_class.new(type: :password) }

    it_behaves_like 'validates string constraints' do
      let(:valid_input) { 'SecureP@ss123' }
      let(:too_short) { 'Pass1!' }
      let(:too_long) { 'P' * 129 }
      let(:invalid_format) { 'onlylowercase' }
    end
  end
end
```

## Notes

### When to Use Parametrization

**Good use cases**:
- Same logic, different inputs (boundary testing)
- Multiple error cases
- Cross-platform or cross-browser testing
- Testing all combinations in a matrix
- Validating multiple formats

**Not ideal for**:
- Tests with completely different logic
- Tests that need different setup/teardown
- Tests where parameters make it less readable

### Choosing the Right Pattern

**Use shared_examples when**:
- Tests have multiple assertions
- Complex setup is required
- Behavior is truly shared across contexts

**Use .each iteration when**:
- Simple input/output testing
- Many test cases with same assertion
- Table-driven tests

### Readable Descriptions

Make parameter descriptions self-explanatory:
```ruby
# ❌ Bad: Unclear what's being tested
[1, 2, 3, 4].each do |n|
  it "test #{n}" do
    expect(calculate(n)).to be_truthy
  end
end

# ✅ Good: Clear test purpose
{
  'minimum value' => 1,
  'typical value' => 2,
  'boundary value' => 3,
  'maximum value' => 4
}.each do |description, value|
  it "handles #{description}" do
    expect(calculate(value)).to be_truthy
  end
end
```

### Organizing Large Parameter Sets

Extract parameters to methods or constants:
```ruby
# ❌ Bad: Inline large dataset
RSpec.describe Parser do
  [/* 50 lines of test data */].each do |test_case|
  end
end

# ✅ Good: Extract to helper
RSpec.describe Parser do
  def parsing_test_cases
    YAML.load_file('spec/fixtures/parsing_test_cases.yml')
  end

  parsing_test_cases.each do |test_case|
    it test_case['description'] do
      result = described_class.parse(test_case['input'])
      expect(result).to eq(test_case['expected'])
    end
  end
end
```

### Matrix Testing

For testing all combinations:
```ruby
# Test every combination of browser x OS x viewport
browsers = [:chrome, :firefox, :safari]
operating_systems = [:windows, :mac, :linux]
viewports = [:mobile, :tablet, :desktop]

browsers.each do |browser|
  operating_systems.each do |os|
    viewports.each do |viewport|
      it "works on #{browser}/#{os}/#{viewport}" do
        # Test this specific combination
      end
    end
  end
end
```

### Shared Context with Parameters

Pass parameters to shared contexts:
```ruby
shared_context 'authenticated user' do |role|
  let(:user) { create(:user, role: role) }
  before { sign_in(user) }
end

[:admin, :moderator, :user].each do |role|
  context "as #{role}" do
    include_context 'authenticated user', role

    it 'has appropriate permissions' do
      expect(user.role).to eq(role)
    end
  end
end
```
