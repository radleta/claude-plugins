# Template: Mock Spec

**When to Use**: Testing code that interacts with external services, APIs, file systems, databases in isolation, third-party libraries, or any dependency you want to isolate.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Using generic doubles instead of verifying doubles (instance_double, class_double)
- Over-mocking (mocking too much internal implementation)
- Not verifying mock expectations (using allow without expect)
- Creating complex mock chains that are hard to maintain
- Mocking value objects that should be real instances
- Not using mock receive counts (once, twice, exactly)
- Forgetting to test both success and failure scenarios with mocks
- Not cleaning up mock state between tests

## Template

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe {{ClassName}} do
  subject(:{{instance_name}}) { described_class.new({{dependencies}}) }

  # Use instance_double for instance methods
  let(:{{dependency_name}}) { instance_double({{DependencyClass}}) }
  let(:{{another_dependency}}) { instance_double({{AnotherClass}}) }

  # Use class_double for class methods
  let(:{{class_dependency}}) { class_double({{SomeClass}}).as_stubbed_const }

  describe '#{{method_name}}' do
    context 'when external service succeeds' do
      let(:{{expected_response}}) { { status: 'success', data: {{data}} } }

      before do
        # Stub method to return value
        allow({{dependency_name}}).to receive(:{{dependency_method}})
          .and_return({{expected_response}})
      end

      it '{{describes_behavior}}' do
        result = {{instance_name}}.{{method_name}}({{arguments}})

        expect(result).to eq({{expected_result}})
      end

      it 'calls dependency with correct arguments' do
        expect({{dependency_name}}).to receive(:{{dependency_method}})
          .with({{expected_args}})

        {{instance_name}}.{{method_name}}({{arguments}})
      end

      it 'calls dependency exactly once' do
        expect({{dependency_name}}).to receive(:{{dependency_method}}).once

        {{instance_name}}.{{method_name}}({{arguments}})
      end

      it 'calls dependencies in correct order' do
        expect({{dependency_name}}).to receive(:{{first_method}}).ordered
        expect({{another_dependency}}).to receive(:{{second_method}}).ordered

        {{instance_name}}.{{method_name}}({{arguments}})
      end

      it 'processes response correctly' do
        {{instance_name}}.{{method_name}}({{arguments}})

        expect({{instance_name}}.{{state_attribute}}).to eq({{expected_state}})
      end
    end

    context 'when external service fails' do
      before do
        # Stub method to raise error
        allow({{dependency_name}}).to receive(:{{dependency_method}})
          .and_raise({{ErrorClass}}, {{error_message}})
      end

      it 'handles error gracefully' do
        result = {{instance_name}}.{{method_name}}({{arguments}})

        expect(result).to be_nil
      end

      it 'logs the error' do
        expect({{logger_dependency}}).to receive(:error)
          .with(/{{error_pattern}}/)

        {{instance_name}}.{{method_name}}({{arguments}})
      end

      it 'does not call subsequent operations' do
        expect({{another_dependency}}).not_to receive(:{{method}})

        {{instance_name}}.{{method_name}}({{arguments}}) rescue nil
      end
    end

    context 'with multiple calls' do
      before do
        # Return different values on consecutive calls
        allow({{dependency_name}}).to receive(:{{dependency_method}})
          .and_return({{first_result}}, {{second_result}}, {{third_result}})
      end

      it 'handles changing responses' do
        first = {{instance_name}}.{{method_name}}({{arguments}})
        second = {{instance_name}}.{{method_name}}({{arguments}})

        expect(first).to eq({{first_result}})
        expect(second).to eq({{second_result}})
      end
    end

    context 'with conditional responses' do
      before do
        # Return different values based on arguments
        allow({{dependency_name}}).to receive(:{{dependency_method}}) do |arg|
          case arg
          when {{condition_1}}
            {{result_1}}
          when {{condition_2}}
            {{result_2}}
          else
            {{default_result}}
          end
        end
      end

      it 'handles first condition' do
        result = {{instance_name}}.{{method_name}}({{condition_1}})

        expect(result).to eq({{result_1}})
      end

      it 'handles second condition' do
        result = {{instance_name}}.{{method_name}}({{condition_2}})

        expect(result).to eq({{result_2}})
      end
    end
  end

  describe 'partial mocking' do
    let(:{{real_instance}}) { {{RealClass}}.new }

    before do
      # Stub only specific method, keep rest real
      allow({{real_instance}}).to receive(:{{method_to_stub}})
        .and_return({{stubbed_value}})
    end

    it 'uses stubbed method' do
      result = {{real_instance}}.{{method_to_stub}}

      expect(result).to eq({{stubbed_value}})
    end

    it 'uses real implementation for other methods' do
      result = {{real_instance}}.{{unstubbed_method}}

      expect(result).to eq({{real_result}})
    end
  end

  describe 'spying on method calls' do
    let(:{{spy_instance}}) { instance_double({{Class}}, {{method}}: {{return_value}}) }

    it 'verifies method was called after execution' do
      {{instance_name}}.{{method_name}}({{spy_instance}})

      expect({{spy_instance}}).to have_received(:{{method}})
        .with({{expected_args}})
    end

    it 'verifies method was not called' do
      {{instance_name}}.{{other_method}}

      expect({{spy_instance}}).not_to have_received(:{{method}})
    end

    it 'verifies method call count' do
      3.times { {{instance_name}}.{{method_name}}({{spy_instance}}) }

      expect({{spy_instance}}).to have_received(:{{method}}).exactly(3).times
    end
  end

  describe 'mocking class methods' do
    before do
      # Mock class method
      allow({{ClassName}}).to receive(:{{class_method}})
        .and_return({{return_value}})
    end

    it 'uses mocked class method' do
      result = {{ClassName}}.{{class_method}}({{arguments}})

      expect(result).to eq({{return_value}})
    end

    it 'verifies class method was called' do
      expect({{ClassName}}).to receive(:{{class_method}})
        .with({{expected_args}})

      described_class.{{method_that_calls_class_method}}
    end
  end

  describe 'mocking constants' do
    before do
      stub_const('{{CONSTANT_NAME}}', {{mock_value}})
    end

    it 'uses mocked constant value' do
      result = {{instance_name}}.{{method_using_constant}}

      expect(result).to include({{mock_value}})
    end
  end

  describe 'mocking external APIs' do
    let(:{{api_client}}) { instance_double({{ApiClientClass}}) }
    let(:{{api_response}}) do
      {
        'id' => {{id}},
        'status' => '{{status}}',
        'data' => {{data}}
      }
    end

    before do
      allow({{api_client}}).to receive(:get)
        .with("/{{endpoint}}/#{{{id}}}")
        .and_return({{api_response}})

      allow({{api_client}}).to receive(:post)
        .with("/{{endpoint}}", {{payload}})
        .and_return({{created_response}})
    end

    it 'fetches data from API' do
      result = {{instance_name}}.fetch_from_api({{id}})

      expect(result['status']).to eq('{{status}}')
    end

    it 'creates resource via API' do
      result = {{instance_name}}.create_via_api({{payload}})

      expect(result).to be_success
      expect({{api_client}}).to have_received(:post)
        .with("/{{endpoint}}", {{payload}})
    end

    context 'when API returns error' do
      before do
        allow({{api_client}}).to receive(:get)
          .and_raise({{ApiError}}.new('Service unavailable'))
      end

      it 'handles API errors' do
        expect {
          {{instance_name}}.fetch_from_api({{id}})
        }.to raise_error({{ApiError}}, /Service unavailable/)
      end
    end
  end

  describe 'mocking file system operations' do
    let(:{{file_path}}) { '/path/to/file.txt' }
    let(:{{file_content}}) { 'mock file content' }

    before do
      allow(File).to receive(:read)
        .with({{file_path}})
        .and_return({{file_content}})

      allow(File).to receive(:write)
        .with({{file_path}}, anything)
        .and_return({{file_content}}.length)
    end

    it 'reads from file' do
      result = {{instance_name}}.read_file({{file_path}})

      expect(result).to eq({{file_content}})
    end

    it 'writes to file' do
      expect(File).to receive(:write)
        .with({{file_path}}, {{new_content}})

      {{instance_name}}.write_file({{file_path}}, {{new_content}})
    end
  end

  describe 'mocking time' do
    let(:{{frozen_time}}) { Time.zone.parse('2025-01-15 10:00:00') }

    it 'freezes time for test' do
      travel_to({{frozen_time}}) do
        result = {{instance_name}}.{{time_dependent_method}}

        expect(result.created_at).to eq({{frozen_time}})
      end
    end

    it 'travels forward in time' do
      travel_to({{frozen_time}}) do
        {{instance_name}}.schedule_event(1.day.from_now)
      end

      travel_to({{frozen_time}} + 1.day) do
        expect({{instance_name}}.{{event}}).to be_triggered
      end
    end
  end
end
```

## Configuration Files

### spec_helper.rb with mocking config

```ruby
# frozen_string_literal: true

RSpec.configure do |config|
  # Verifying doubles
  config.mock_with :rspec do |mocks|
    # Verify that mocked methods actually exist
    mocks.verify_partial_doubles = true
    mocks.verify_doubled_constant_names = true
  end

  # Reset mocks after each test
  config.after(:each) do
    RSpec::Mocks.space.reset_all
  end
end
```

## Adaptation Rules

- [ ] Replace `{{ClassName}}`, `{{DependencyClass}}` with actual classes
- [ ] Use `instance_double` for instance methods (recommended)
- [ ] Use `class_double` for class methods
- [ ] Use `spy` pattern with `have_received` when order doesn't matter
- [ ] Use `expect().to receive()` when order matters
- [ ] Mock only external dependencies (APIs, file system, time)
- [ ] Keep internal logic real (don't over-mock)
- [ ] Test both success and failure paths
- [ ] Verify arguments passed to mocks
- [ ] Clean up global mocks (time, constants) after tests

## Related

- Rule: @rules/mocking-best-practices.md
- Template: @templates/rspec/basic_unit_spec.rb
- Decision: @decision-trees/when-to-mock.md

## Example: Payment Service with External API

```ruby
# frozen_string_literal: true

require 'spec_helper'

RSpec.describe PaymentService do
  subject(:service) { described_class.new(payment_gateway, logger) }

  let(:payment_gateway) { instance_double(StripeGateway) }
  let(:logger) { instance_double(Logger) }
  let(:user) { double('User', id: 123, email: 'test@example.com') }
  let(:amount) { 1000 } # $10.00 in cents

  describe '#charge' do
    context 'when payment succeeds' do
      let(:charge_response) do
        {
          id: 'ch_123',
          status: 'succeeded',
          amount: amount
        }
      end

      before do
        allow(payment_gateway).to receive(:create_charge)
          .and_return(charge_response)
        allow(logger).to receive(:info)
      end

      it 'creates a charge' do
        result = service.charge(user, amount)

        expect(result).to be_success
        expect(result.charge_id).to eq('ch_123')
      end

      it 'calls gateway with correct parameters' do
        expect(payment_gateway).to receive(:create_charge)
          .with(
            amount: amount,
            currency: 'usd',
            customer_email: user.email
          )

        service.charge(user, amount)
      end

      it 'logs successful payment' do
        expect(logger).to receive(:info)
          .with("Payment succeeded: ch_123 for user #{user.id}")

        service.charge(user, amount)
      end
    end

    context 'when payment fails' do
      before do
        allow(payment_gateway).to receive(:create_charge)
          .and_raise(StripeError.new('Card declined'))
        allow(logger).to receive(:error)
      end

      it 'handles payment failure' do
        result = service.charge(user, amount)

        expect(result).to be_failure
        expect(result.error_message).to eq('Card declined')
      end

      it 'logs the error' do
        expect(logger).to receive(:error)
          .with(/Card declined/)

        service.charge(user, amount)
      end

      it 'does not retry on card errors' do
        expect(payment_gateway).to receive(:create_charge).once

        service.charge(user, amount)
      end
    end

    context 'when network error occurs' do
      before do
        call_count = 0
        allow(payment_gateway).to receive(:create_charge) do
          call_count += 1
          raise NetworkError if call_count < 3
          { id: 'ch_123', status: 'succeeded', amount: amount }
        end
      end

      it 'retries on network errors' do
        result = service.charge(user, amount)

        expect(result).to be_success
        expect(payment_gateway).to have_received(:create_charge).exactly(3).times
      end
    end
  end

  describe '#refund' do
    let(:charge_id) { 'ch_123' }
    let(:refund_response) do
      {
        id: 're_123',
        status: 'succeeded',
        charge: charge_id
      }
    end

    before do
      allow(payment_gateway).to receive(:create_refund)
        .and_return(refund_response)
      allow(logger).to receive(:info)
    end

    it 'processes refund' do
      result = service.refund(charge_id, amount)

      expect(result).to be_success
      expect(payment_gateway).to have_received(:create_refund)
        .with(charge: charge_id, amount: amount)
    end
  end

  describe 'time-sensitive operations' do
    let(:frozen_time) { Time.zone.parse('2025-01-15 14:30:00') }

    it 'calculates daily limit correctly' do
      travel_to(frozen_time) do
        service.charge(user, 5000)
        service.charge(user, 5000)

        expect(service.daily_total(user)).to eq(10000)
      end

      # Next day
      travel_to(frozen_time + 1.day) do
        expect(service.daily_total(user)).to eq(0)
      end
    end
  end
end
```

## Notes

### When to Mock

**DO mock**:
- External APIs and services
- File system operations
- Network calls
- Time-dependent code
- Random number generation
- Email sending
- Database queries (in unit tests)

**DON'T mock**:
- Value objects (String, Integer, etc.)
- Internal business logic
- Simple data structures
- Code under test

### Verifying Doubles

Always use verifying doubles to catch typos:
```ruby
# ❌ No verification - typo not caught
double = double('User')
allow(double).to receive(:naem)  # Typo!

# ✅ Verifies method exists
double = instance_double(User)
allow(double).to receive(:naem)  # Error: User does not implement naem
```

### Allow vs Expect

**Use `allow`** when you don't care if method is called:
```ruby
allow(service).to receive(:optional_callback).and_return(true)
```

**Use `expect`** when method MUST be called:
```ruby
expect(service).to receive(:required_method).with(args)
```

### Receive Counts

Be specific about how many times:
```ruby
expect(mock).to receive(:method).once
expect(mock).to receive(:method).twice
expect(mock).to receive(:method).exactly(3).times
expect(mock).to receive(:method).at_least(2).times
expect(mock).to receive(:method).at_most(5).times
expect(mock).not_to receive(:method)
```

### Argument Matchers

Use matchers for flexible argument matching:
```ruby
# Exact match
expect(mock).to receive(:method).with(1, 'string')

# Any args
expect(mock).to receive(:method).with(any_args)

# Type checking
expect(mock).to receive(:method).with(instance_of(String))

# Pattern matching
expect(mock).to receive(:method).with(hash_including(key: value))
expect(mock).to receive(:method).with(array_including(1, 2))
expect(mock).to receive(:method).with(/pattern/)

# Custom matching
expect(mock).to receive(:method) do |arg|
  expect(arg).to be > 10
end
```

### Mock Chains (Use Sparingly)

```ruby
# ❌ Avoid complex chains - hard to maintain
allow(user).to receive_message_chain(:account, :subscription, :active?)
  .and_return(true)

# ✅ Better - create proper test doubles
account = instance_double(Account)
subscription = instance_double(Subscription, active?: true)
allow(user).to receive(:account).and_return(account)
allow(account).to receive(:subscription).and_return(subscription)
```
