# Template: Async Spec

**When to Use**: Testing asynchronous operations, background jobs (Sidekiq, Resque, DelayedJob), WebSockets, callbacks, event-driven code, polling mechanisms.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Using sleep() for fixed delays instead of proper waiting mechanisms
- Not testing async completion at all (only testing job enqueue)
- Race conditions between test execution and async operations
- Not clearing job queues between tests
- Not testing job retry behavior and failure scenarios
- Using real background processing in tests (should use inline or test mode)
- Not verifying side effects that happen after async completion
- Missing timeout configurations for slow operations

## Template

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe {{ServiceClass}}, type: :service do
  describe 'async operations' do
    # Use ActiveJob test helpers
    include ActiveJob::TestHelper

    after do
      clear_enqueued_jobs
      clear_performed_jobs
    end

    describe '#{{method_that_enqueues_job}}' do
      let(:{{resource}}) { create(:{{factory_name}}) }

      it 'enqueues {{JobClass}}' do
        expect {
          {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
        }.to have_enqueued_job({{JobClass}})
      end

      it 'enqueues job with correct arguments' do
        expect {
          {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
        }.to have_enqueued_job({{JobClass}}).with({{resource}}.id, {{other_args}})
      end

      it 'enqueues job on correct queue' do
        expect {
          {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
        }.to have_enqueued_job({{JobClass}}).on_queue('{{queue_name}}')
      end

      it 'schedules job for future execution' do
        expected_time = 1.hour.from_now

        expect {
          {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}}, delay: 1.hour)
        }.to have_enqueued_job({{JobClass}}).at(expected_time)
      end

      context 'when performing enqueued jobs' do
        it 'executes the job successfully' do
          perform_enqueued_jobs do
            {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
          end

          {{resource}}.reload
          expect({{resource}}.{{state_attribute}}).to eq({{expected_state}})
        end

        it 'triggers expected side effects' do
          expect {
            perform_enqueued_jobs do
              {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
            end
          }.to change { {{ObservableModel}}.count }.by(1)
        end

        it 'sends notifications after completion' do
          expect({{NotificationService}}).to receive(:notify)

          perform_enqueued_jobs do
            {{ServiceClass}}.new.{{method_that_enqueues_job}}({{resource}})
          end
        end
      end
    end

    describe 'job retry behavior' do
      let(:{{job_instance}}) { {{JobClass}}.new }

      context 'when job fails with retryable error' do
        before do
          allow({{ExternalService}}).to receive(:{{method}})
            .and_raise({{RetryableError}})
        end

        it 'retries the job' do
          expect {
            {{job_instance}}.perform({{arguments}})
          }.to raise_error({{RetryableError}})
            .and have_enqueued_job({{JobClass}}).on_queue('default')
        end

        it 'increments retry count' do
          attempts = 0
          allow({{ExternalService}}).to receive(:{{method}}) do
            attempts += 1
            raise {{RetryableError}} if attempts < 3
            true
          end

          perform_enqueued_jobs do
            {{JobClass}}.perform_later({{arguments}})
          end

          expect(attempts).to eq(3)
        end
      end

      context 'when job fails with non-retryable error' do
        before do
          allow({{ExternalService}}).to receive(:{{method}})
            .and_raise({{FatalError}})
        end

        it 'does not retry the job' do
          expect {
            {{job_instance}}.perform({{arguments}})
          }.to raise_error({{FatalError}})
            .and not_have_enqueued_job({{JobClass}})
        end

        it 'logs the error' do
          expect(Rails.logger).to receive(:error).with(/{{FatalError}}/)

          {{job_instance}}.perform({{arguments}}) rescue nil
        end
      end
    end

    describe 'async callbacks' do
      let(:{{resource}}) { create(:{{factory_name}}) }
      let(:{{callback_tracker}}) { [] }

      it 'executes callback after async operation completes' do
        {{ServiceClass}}.new.{{async_method}}({{resource}}) do |result|
          {{callback_tracker}} << result
        end

        wait_for { {{callback_tracker}}.any? }.to eq(true)
        expect({{callback_tracker}}.first).to eq({{expected_result}})
      end

      it 'handles callback errors gracefully' do
        {{ServiceClass}}.new.{{async_method}}({{resource}}) do
          raise 'Callback error'
        end

        # Should not propagate error to main thread
        wait_for { {{resource}}.reload.{{state}} }.to eq(:completed)
        expect({{resource}}.error_message).to include('Callback error')
      end
    end
  end

  describe 'WebSocket operations', type: :channel do
    let(:{{user}}) { create(:{{user_factory}}) }
    let(:{{channel}}) { {{ChannelClass}}.new(connection, {}) }

    before do
      stub_connection current_user: {{user}}
    end

    describe '#subscribed' do
      it 'successfully subscribes to stream' do
        subscribe

        expect(subscription).to be_confirmed
        expect(subscription).to have_stream_from("{{stream_name}}_#{{{user}}.id}")
      end
    end

    describe '#{{channel_action}}' do
      it 'broadcasts message asynchronously' do
        subscribe

        expect {
          {{channel}}.{{channel_action}}({{data}})
        }.to have_broadcasted_to("{{stream_name}}_#{{{user}}.id}")
          .from_channel({{ChannelClass}})
          .with({{expected_broadcast_data}})
      end

      it 'broadcasts to multiple subscribers' do
        subscribe
        other_subscription = subscribe({{other_user}})

        {{channel}}.{{channel_action}}({{data}})

        wait_for { {{received_messages}}.size }.to eq(2)
      end
    end

    describe 'async message delivery' do
      it 'delivers messages in order' do
        subscribe
        messages = []

        3.times do |i|
          {{channel}}.send_message("Message #{i}")
        end

        wait_for { messages.size }.to eq(3)
        expect(messages).to eq(['Message 0', 'Message 1', 'Message 2'])
      end

      it 'handles disconnection gracefully' do
        subscribe
        unsubscribe

        expect {
          {{channel}}.send_message('After disconnect')
        }.not_to raise_error
      end
    end
  end

  describe 'polling operations' do
    let(:{{poller}}) { {{PollerClass}}.new(interval: 0.1) }

    after do
      {{poller}}.stop
    end

    it 'polls at specified interval' do
      poll_count = 0

      {{poller}}.on_poll do
        poll_count += 1
      end

      {{poller}}.start

      wait_for { poll_count }.to be >= 3
      expect(poll_count).to be_between(3, 5)
    end

    it 'stops polling when requested' do
      poll_count = 0

      {{poller}}.on_poll { poll_count += 1 }
      {{poller}}.start

      wait_for { poll_count }.to be >= 2

      {{poller}}.stop
      final_count = poll_count

      sleep 0.3
      expect(poll_count).to eq(final_count)
    end

    it 'handles errors during polling' do
      error_count = 0

      {{poller}}.on_poll do
        error_count += 1
        raise 'Poll error' if error_count < 3
      end

      {{poller}}.on_error { |e| Rails.logger.error(e) }
      {{poller}}.start

      wait_for { error_count }.to be >= 3
      expect({{poller}}).to be_running
    end
  end

  describe 'timeout handling' do
    it 'completes within timeout' do
      result = nil

      Timeout.timeout(1) do
        result = {{ServiceClass}}.new.{{fast_async_method}}
        wait_for { result }.to be_present
      end

      expect(result).to eq({{expected_result}})
    end

    it 'raises timeout error for slow operations' do
      expect {
        Timeout.timeout(0.1) do
          {{ServiceClass}}.new.{{slow_async_method}}
          wait_for { false }.to eq(true)
        end
      }.to raise_error(Timeout::Error)
    end

    it 'cancels operation on timeout' do
      operation = {{ServiceClass}}.new

      expect {
        Timeout.timeout(0.1) do
          operation.{{long_running_method}}
        end
      }.to raise_error(Timeout::Error)

      expect(operation).to be_cancelled
    end
  end
end

# Helper methods for async testing
module AsyncHelpers
  # Wait for condition to be true with timeout
  def wait_for(timeout: 2, &block)
    Timeout.timeout(timeout) do
      sleep 0.01 until block.call
      block.call
    end
  end

  # Wait for value to change
  def wait_for_change(timeout: 2, &block)
    initial_value = block.call
    Timeout.timeout(timeout) do
      sleep 0.01 until block.call != initial_value
      block.call
    end
  end

  # Eventually matcher for async expectations
  def eventually(timeout: 2)
    Timeout.timeout(timeout) do
      loop do
        begin
          yield
          break
        rescue RSpec::Expectations::ExpectationNotMetError
          sleep 0.01
        end
      end
    end
  end
end

RSpec.configure do |config|
  config.include AsyncHelpers
  config.include ActiveJob::TestHelper
end
```

## Configuration Files

### sidekiq_testing.rb (for Sidekiq)

```ruby
# spec/support/sidekiq_testing.rb
require 'sidekiq/testing'

RSpec.configure do |config|
  config.before(:each) do
    Sidekiq::Worker.clear_all
  end

  config.before(:each, :inline_jobs) do
    Sidekiq::Testing.inline!
  end

  config.after(:each, :inline_jobs) do
    Sidekiq::Testing.fake!
  end
end
```

### Job Example

```ruby
# app/jobs/{{job_class}}.rb
class {{JobClass}} < ApplicationJob
  queue_as :{{queue_name}}

  retry_on {{RetryableError}}, wait: :exponentially_longer, attempts: 5
  discard_on {{FatalError}}

  def perform({{arguments}})
    {{ExternalService}}.{{method}}({{arguments}})
  end
end
```

## Adaptation Rules

- [ ] Replace `{{ServiceClass}}`, `{{JobClass}}` with actual class names
- [ ] Configure correct job framework (Sidekiq, Resque, DelayedJob)
- [ ] Use `wait_for` helper for async assertions
- [ ] Set appropriate timeouts for your operations
- [ ] Test both job enqueue and execution
- [ ] Test retry and failure scenarios
- [ ] Clear job queues in before/after hooks
- [ ] Use inline mode when you need immediate execution
- [ ] Test callbacks and side effects
- [ ] Add WebSocket tests if using ActionCable

## Related

- Rule: @rules/async-testing-patterns.md
- Template: @templates/rspec/integration_spec.rb
- Decision: @decision-trees/background-job-testing.md

## Example: Email Notification Job

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe NotificationService, type: :service do
  include ActiveJob::TestHelper

  let(:user) { create(:user, email: 'test@example.com') }
  let(:article) { create(:article) }

  after do
    clear_enqueued_jobs
  end

  describe '#send_notification' do
    it 'enqueues email job' do
      expect {
        NotificationService.new.send_notification(user, article)
      }.to have_enqueued_job(SendEmailJob)
        .with(user.id, article.id, 'new_article')
        .on_queue('mailers')
    end

    it 'schedules email for optimal delivery time' do
      expected_time = Time.zone.now.change(hour: 9).tomorrow

      expect {
        NotificationService.new.send_notification(user, article, optimal_time: true)
      }.to have_enqueued_job(SendEmailJob).at(expected_time)
    end

    context 'when performing the job', :inline_jobs do
      it 'sends email successfully' do
        expect {
          NotificationService.new.send_notification(user, article)
        }.to change { ActionMailer::Base.deliveries.count }.by(1)
      end

      it 'marks notification as sent' do
        perform_enqueued_jobs do
          NotificationService.new.send_notification(user, article)
        end

        notification = Notification.last
        expect(notification).to be_sent
        expect(notification.sent_at).to be_within(1.second).of(Time.current)
      end
    end
  end

  describe 'retry behavior' do
    before do
      allow(NotificationMailer).to receive(:new_article)
        .and_raise(Net::SMTPServerBusy, 'Server busy')
    end

    it 'retries on SMTP errors' do
      expect {
        SendEmailJob.new.perform(user.id, article.id, 'new_article')
      }.to raise_error(Net::SMTPServerBusy)
        .and have_enqueued_job(SendEmailJob)
    end

    it 'uses exponential backoff' do
      job = SendEmailJob.new
      job.executions = 3

      expect(job.class).to receive(:set)
        .with(wait: 9) # 3^2 seconds
        .and_call_original

      job.perform(user.id, article.id, 'new_article') rescue nil
    end

    it 'gives up after max attempts' do
      5.times do
        perform_enqueued_jobs rescue nil
      end

      notification = Notification.last
      expect(notification).to be_failed
      expect(notification.error_message).to include('Server busy')
    end
  end

  describe 'batch notifications' do
    let(:users) { create_list(:user, 50) }

    it 'enqueues jobs for all users' do
      expect {
        NotificationService.new.send_batch(users, article)
      }.to have_enqueued_job(SendEmailJob).exactly(50).times
    end

    it 'completes all jobs successfully', :inline_jobs do
      perform_enqueued_jobs do
        NotificationService.new.send_batch(users, article)
      end

      expect(Notification.where(sent: true).count).to eq(50)
    end

    it 'continues on individual failures' do
      allow(NotificationMailer).to receive(:new_article).and_call_original
      allow(NotificationMailer).to receive(:new_article)
        .with(users[10], anything)
        .and_raise('Email error')

      perform_enqueued_jobs do
        NotificationService.new.send_batch(users, article)
      end

      expect(Notification.where(sent: true).count).to eq(49)
      expect(Notification.where(failed: true).count).to eq(1)
    end
  end

  describe 'WebSocket notifications', type: :channel do
    let(:connection) { NotificationChannel.new(connection, {}) }

    before do
      stub_connection current_user: user
    end

    it 'broadcasts real-time notification' do
      subscribe

      expect {
        NotificationService.new.send_realtime(user, article)
      }.to have_broadcasted_to("notifications_#{user.id}")
        .from_channel(NotificationChannel)
        .with(hash_including(
          type: 'new_article',
          article_id: article.id
        ))
    end

    it 'queues notification if user offline' do
      expect {
        NotificationService.new.send_realtime(user, article)
      }.to change { QueuedNotification.count }.by(1)
    end
  end
end
```

## Notes

### Wait Helpers

Never use `sleep()` for fixed delays:
```ruby
# ❌ Bad: Flaky and slow
sleep 2
expect(result).to be_present

# ✅ Good: Wait for condition
wait_for { result }.to be_present

# ✅ Good: Eventually matcher
eventually { expect(result).to be_present }
```

### ActiveJob Test Helpers

Use built-in matchers:
```ruby
have_enqueued_job(JobClass)                    # Job was enqueued
  .with(arg1, arg2)                            # With specific args
  .on_queue('queue_name')                      # On specific queue
  .at(time)                                    # At specific time
  .exactly(n).times                            # Exactly n times

perform_enqueued_jobs                          # Execute all enqueued jobs
clear_enqueued_jobs                            # Clear job queue
```

### Job Testing Modes

**Fake mode** (default): Jobs enqueued but not executed
```ruby
Sidekiq::Testing.fake!
MyJob.perform_later(args)  # Enqueued, not executed
```

**Inline mode**: Jobs executed immediately
```ruby
Sidekiq::Testing.inline!
MyJob.perform_later(args)  # Executed immediately
```

### Race Conditions

Avoid race conditions with proper waiting:
```ruby
# ❌ Race condition
job.perform_async(id)
expect(Model.find(id).status).to eq('processed')  # May not be done yet

# ✅ Wait for completion
job.perform_async(id)
wait_for { Model.find(id).status }.to eq('processed')
```

### Timeout Best Practices

Set generous timeouts for async operations:
```ruby
# Too tight (flaky in CI)
wait_for(timeout: 0.1) { condition }

# Better
wait_for(timeout: 2) { condition }

# For very slow operations
wait_for(timeout: 10) { expensive_operation }
```
