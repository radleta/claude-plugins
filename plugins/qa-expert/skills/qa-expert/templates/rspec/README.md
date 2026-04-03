# RSpec Test Templates

This directory contains comprehensive RSpec test templates for Ruby and Rails testing. Each template follows BDD (Behavior-Driven Development) best practices and includes common pitfalls that AI agents should avoid.

## Available Templates

### 1. basic_unit_spec.rb (~380 lines)
**When to Use**: Testing Ruby classes, modules, service objects, and pure logic without Rails dependencies or external services.

**Complexity**: Low

**Key Features**:
- Proper describe/context/it hierarchy
- let vs let! usage patterns
- Edge case testing (nil, empty, boundary values)
- Subject and shared examples
- RSpec matchers guide

**Common Mistakes Covered**:
- Poor test organization
- Missing edge cases
- Incorrect let/let! usage
- Generic test descriptions

### 2. integration_spec.rb (~606 lines)
**When to Use**: Testing Rails controllers, models with database interactions, request/response cycles, full feature workflows.

**Complexity**: Medium

**Key Features**:
- Complete CRUD operation testing
- FactoryBot integration
- Database cleaner configuration
- Authentication/authorization testing
- JSON response validation
- Pagination and filtering

**Common Mistakes Covered**:
- Not using database_cleaner properly
- Shared state between tests
- Missing authentication scenarios
- Not testing full request cycle

### 3. async_spec.rb (~634 lines)
**When to Use**: Testing asynchronous operations, background jobs (Sidekiq, Resque), WebSockets, callbacks, event-driven code.

**Complexity**: Medium

**Key Features**:
- ActiveJob test helpers
- Job enqueue and execution testing
- Retry behavior testing
- WebSocket/ActionCable testing
- Polling mechanism testing
- Timeout handling
- wait_for helper patterns

**Common Mistakes Covered**:
- Using fixed sleep() delays
- Not testing job completion
- Race conditions
- Not clearing job queues
- Missing retry scenarios

### 4. mock_spec.rb (~609 lines)
**When to Use**: Testing code with external dependencies (APIs, file systems, third-party services).

**Complexity**: Medium

**Key Features**:
- instance_double and class_double usage
- Verifying doubles for type safety
- Spy pattern with have_received
- Partial mocking
- Time mocking with travel_to
- File system mocking
- API response mocking

**Common Mistakes Covered**:
- Using generic doubles instead of verifying doubles
- Over-mocking internal implementation
- Not verifying mock expectations
- Complex mock chains
- Forgetting to test failure scenarios

### 5. parametrized_spec.rb (~576 lines)
**When to Use**: Testing same logic with multiple inputs, table-driven tests, boundary value testing, permission matrices.

**Complexity**: Low

**Key Features**:
- Multiple parametrization patterns
- shared_examples with parameters
- Boundary value testing
- Combination/matrix testing
- Error case parametrization
- State transition testing

**Common Mistakes Covered**:
- Ineffective use of shared_examples
- Unclear parametrized descriptions
- Missing edge cases in parameters
- Overly complex parametrization
- Poor organization of test cases

## Usage Instructions

### 1. Choose the Right Template

Match your testing needs to the template:
- **Unit testing pure Ruby logic?** → `basic_unit_spec.rb`
- **Testing Rails API endpoints?** → `integration_spec.rb`
- **Testing background jobs?** → `async_spec.rb`
- **Testing external API integrations?** → `mock_spec.rb`
- **Testing multiple input scenarios?** → `parametrized_spec.rb`

### 2. Replace Placeholders

All templates use `{{placeholder}}` syntax:
- `{{ClassName}}` → Your class name (PascalCase)
- `{{method_name}}` → Your method name (snake_case)
- `{{variable_name}}` → Variable names
- `{{factory_name}}` → FactoryBot factory names
- `{{expected_value}}` → Expected test results

### 3. Follow Adaptation Rules

Each template includes an "Adaptation Rules" checklist. Complete all items:
- [ ] Replace all placeholders
- [ ] Remove unused sections
- [ ] Add domain-specific edge cases
- [ ] Update configuration for your environment
- [ ] Verify all dependencies are available

### 4. Configuration Files

Templates include necessary configuration:
- `.rspec` - RSpec command-line configuration
- `spec_helper.rb` - Basic RSpec setup
- `rails_helper.rb` - Rails-specific setup (integration tests)
- Support files for specific features (Sidekiq, FactoryBot)

## Template Structure

Each template follows this structure:

```markdown
# Template: [Template Name]

**When to Use**: [Specific use cases]
**Complexity**: [Low/Medium/High]
**Common Mistakes Agents Make**: [5+ specific pitfalls]

## Template
[Full template code with {{placeholders}}]

## Configuration Files
[Related configuration files]

## Adaptation Rules
- [ ] Checklist of required adaptations

## Related
- Links to related rules/templates

## Example: [Concrete Example]
[Real-world example with placeholders filled in]

## Notes
[Additional guidance, best practices, anti-patterns]
```

## Common Patterns Across Templates

### Test Organization
```ruby
describe '#method_name' do       # What are we testing?
  context 'when condition' do    # Under what circumstances?
    it 'expected behavior' do    # What should happen?
      # Test code
    end
  end
end
```

### Let vs Let!
```ruby
let(:user) { create(:user) }     # Lazy: created when first referenced
let!(:admin) { create(:admin) }  # Eager: created immediately
```

### Proper Expectations
```ruby
# ✅ Good: Specific behavior descriptions
it 'creates a new user record' do
  expect { service.call }.to change(User, :count).by(1)
end

# ❌ Bad: Generic descriptions
it 'works' do
  expect(service.call).to be_truthy
end
```

## Best Practices

### 1. One Assertion Per Behavior
Group related assertions, but keep tests focused:
```ruby
# ✅ Good: Related assertions about the same result
it 'creates a valid user' do
  user = User.create(name: 'John')
  expect(user).to be_persisted
  expect(user.name).to eq('John')
end
```

### 2. Test Behavior, Not Implementation
```ruby
# ❌ Bad: Testing implementation
it 'calls private method' do
  expect(object).to receive(:internal_calculation)
  object.public_method
end

# ✅ Good: Testing observable behavior
it 'returns calculated result' do
  result = object.public_method
  expect(result).to eq(expected_value)
end
```

### 3. Use Descriptive Names
```ruby
# ❌ Bad
let(:u) { create(:user) }
let(:data) { { a: 1, b: 2 } }

# ✅ Good
let(:admin_user) { create(:user, :admin) }
let(:payment_params) { { amount: 1000, currency: 'USD' } }
```

### 4. Test Edge Cases
Always consider:
- Nil/null values
- Empty collections
- Boundary values (0, -1, MAX, MIN)
- Invalid types
- Large inputs

## Integration with qa-expert Skill

These templates are designed to be used by the `qa-expert` skill when generating tests. The skill should:

1. Analyze the code to be tested
2. Select the appropriate template(s)
3. Fill in all `{{placeholders}}` with context-specific values
4. Add domain-specific edge cases
5. Ensure configuration files are present
6. Verify all tests run and pass

## Examples Directory

For complete working examples, see:
- `/examples/basic_unit_spec_example.rb` - UserService unit tests
- `/examples/integration_spec_example.rb` - ArticlesController API tests
- `/examples/async_spec_example.rb` - EmailNotification job tests
- `/examples/mock_spec_example.rb` - PaymentService with Stripe API
- `/examples/parametrized_spec_example.rb` - Calculator with multiple operations

## Contributing

When adding new templates:
1. Follow the existing template structure
2. Include 5+ common mistakes agents make
3. Provide complete configuration files
4. Add concrete examples
5. Document all patterns in this README
6. Ensure templates are 200-250 lines minimum
7. Use consistent `{{placeholder}}` syntax

## Version History

- v1.0.0 - Initial release with 5 core templates
  - basic_unit_spec.rb (380 lines)
  - integration_spec.rb (606 lines)
  - async_spec.rb (634 lines)
  - mock_spec.rb (609 lines)
  - parametrized_spec.rb (576 lines)

Total: 2,805 lines of comprehensive RSpec testing guidance
