# RSpec Templates Quick Reference

## Template Selection Guide

| Testing Scenario | Template | Lines | Complexity |
|-----------------|----------|-------|------------|
| Ruby classes, modules, pure logic | `basic_unit_spec.rb` | 380 | Low |
| Rails controllers, models, API endpoints | `integration_spec.rb` | 606 | Medium |
| Background jobs, async operations, WebSockets | `async_spec.rb` | 634 | Medium |
| External APIs, mocking dependencies | `mock_spec.rb` | 609 | Medium |
| Multiple inputs, table-driven tests | `parametrized_spec.rb` | 576 | Low |

## Common Mistakes by Template

### basic_unit_spec.rb
1. Not organizing tests with proper describe/context/it hierarchy
2. Using generic test descriptions like "it works"
3. Not testing edge cases (nil, empty, boundary values)
4. Missing before blocks to DRY up test setup
5. Not using let/let! appropriately
6. Mixing subject and explicit variable names
7. Not using shared examples when testing similar behavior

### integration_spec.rb
1. Not using database_cleaner or proper transaction rollback
2. Creating shared state between tests
3. Not using FactoryBot for test data creation
4. Mixing unit test style with integration test style
5. Not testing the full request/response cycle
6. Using let! everywhere instead of understanding lazy vs eager
7. Not testing different HTTP methods and status codes
8. Forgetting to test authentication/authorization scenarios

### async_spec.rb
1. Using sleep() for fixed delays instead of proper waiting
2. Not testing async completion (only testing job enqueue)
3. Race conditions between test execution and async operations
4. Not clearing job queues between tests
5. Not testing job retry behavior and failure scenarios
6. Using real background processing in tests
7. Not verifying side effects after async completion
8. Missing timeout configurations for slow operations

### mock_spec.rb
1. Using generic doubles instead of verifying doubles
2. Over-mocking (mocking too much internal implementation)
3. Not verifying mock expectations (using allow without expect)
4. Creating complex mock chains that are hard to maintain
5. Mocking value objects that should be real instances
6. Not using mock receive counts (once, twice, exactly)
7. Forgetting to test both success and failure scenarios
8. Not cleaning up mock state between tests

### parametrized_spec.rb
1. Not using shared_examples effectively for DRY tests
2. Creating unclear parametrized test descriptions
3. Mixing unrelated test cases in the same parametrized block
4. Not providing context-specific descriptions for each parameter set
5. Using overly complex parametrization that hurts readability
6. Not testing the right combinations (missing edge cases)
7. Making parameter tables too large and unmaintainable

## Essential RSpec Patterns

### Test Organization
```ruby
describe '#method_name' do       # What?
  context 'when condition' do    # When?
    it 'expected behavior' do    # Then?
```

### Let vs Let!
```ruby
let(:user)  { create(:user) }   # Lazy (created when referenced)
let!(:admin) { create(:admin) }  # Eager (created immediately)
```

### Expectations
```ruby
expect(value).to eq(expected)
expect(value).to be > 5
expect(array).to include(item)
expect { code }.to raise_error(Error)
expect { code }.to change { count }.by(1)
```

### Mocking
```ruby
# Stubbing
allow(object).to receive(:method).and_return(value)

# Expecting
expect(object).to receive(:method).with(args)

# Spying
expect(object).to have_received(:method).with(args)

# Verifying doubles
instance_double(ClassName)
class_double(ClassName)
```

### Async Testing
```ruby
# Test job enqueue
expect { code }.to have_enqueued_job(JobClass)

# Execute jobs
perform_enqueued_jobs do
  code
end

# Wait for condition
wait_for { condition }.to eq(true)
```

### Parametrization
```ruby
# Array of test cases
[case1, case2].each do |test_case|
  it "handles #{test_case}" do
    # test
  end
end

# Shared examples
shared_examples 'behavior' do
  it 'does something' do
    # test
  end
end

it_behaves_like 'behavior'
```

## Configuration Checklist

- [ ] `.rspec` file for command-line options
- [ ] `spec_helper.rb` for basic RSpec setup
- [ ] `rails_helper.rb` for Rails integration (if Rails app)
- [ ] `database_cleaner` configured (integration tests)
- [ ] `factory_bot_rails` installed and configured
- [ ] `sidekiq/testing` configured (if using Sidekiq)
- [ ] Verify partial doubles enabled
- [ ] Random test order enabled

## Placeholder Conventions

| Placeholder | Replacement | Example |
|-------------|-------------|---------|
| `{{ClassName}}` | PascalCase class name | `UserService` |
| `{{method_name}}` | snake_case method | `calculate_total` |
| `{{variable_name}}` | snake_case variable | `current_user` |
| `{{factory_name}}` | FactoryBot factory | `:user`, `:article` |
| `{{CONSTANT}}` | SCREAMING_SNAKE_CASE | `MAX_ATTEMPTS` |
| `{{attribute}}` | snake_case attribute | `email`, `status` |

## Essential Matchers

### Equality & Identity
- `eq(value)` - Value equality
- `be(value)` - Object identity
- `equal(value)` - Same object
- `be_nil` - Is nil
- `be_truthy` / `be_falsey` - Truthiness

### Comparison
- `be > value` - Greater than
- `be >= value` - Greater or equal
- `be < value` - Less than
- `be_between(min, max)` - In range
- `be_within(delta).of(value)` - Approximate

### Collections
- `include(item)` - Contains item
- `match_array([items])` - Same items, any order
- `contain_exactly(items)` - Exact match
- `be_empty` - Empty collection
- `have(n).items` - Collection size

### Types & Methods
- `be_a(Class)` - Is instance of
- `be_an_instance_of(Class)` - Exact type
- `respond_to(:method)` - Has method
- `have_attributes(hash)` - Attribute values

### Strings & Patterns
- `match(/regex/)` - Regex match
- `start_with(string)` - Prefix
- `end_with(string)` - Suffix
- `include(substring)` - Contains

### Predicates
- `be_valid` - Calls `valid?`
- `be_persisted` - Calls `persisted?`
- `be_empty` - Calls `empty?`

### Changes
- `change { block }.from(x).to(y)` - State change
- `change { block }.by(n)` - Relative change
- `change { block }.by_at_least(n)` - Minimum change

### Errors
- `raise_error(ErrorClass)` - Any error of type
- `raise_error(ErrorClass, message)` - Specific message
- `raise_error(ErrorClass, /pattern/)` - Message pattern

## File Locations

All templates are in: `/workspace/repo/.claude/skills/qa-expert/templates/rspec/`

```
rspec/
├── README.md                  # Full documentation
├── QUICK_REFERENCE.md         # This file
├── basic_unit_spec.rb         # 380 lines - Pure Ruby testing
├── integration_spec.rb        # 606 lines - Rails/API testing
├── async_spec.rb              # 634 lines - Background jobs/async
├── mock_spec.rb               # 609 lines - Mocking/stubbing
└── parametrized_spec.rb       # 576 lines - Table-driven tests
```

**Total: 2,805 lines of RSpec testing templates**
