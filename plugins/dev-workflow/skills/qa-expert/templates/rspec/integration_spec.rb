# Template: Integration Spec

**When to Use**: Testing Rails controllers, models with database interactions, request/response cycles, full feature workflows with multiple components.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not using database_cleaner or proper transaction rollback strategies
- Creating shared state between tests that causes flaky failures
- Not using FactoryBot for test data creation
- Mixing unit test style with integration test style
- Not testing the full request/response cycle (stopping at controller)
- Using let! everywhere instead of understanding lazy vs eager evaluation
- Not testing different HTTP methods and status codes
- Forgetting to test authentication/authorization scenarios

## Template

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe {{ControllerName}}Controller, type: :request do
  # Use let for lazy-loaded test data
  let(:{{resource_name}}) { create(:{{factory_name}}, {{attributes}}) }
  let(:{{user_name}}) { create(:{{user_factory}}) }
  let(:{{valid_params}}) do
    {
      {{resource_name}}: {
        {{attribute_name}}: {{value}},
        {{another_attribute}}: {{value}}
      }
    }
  end
  let(:{{invalid_params}}) do
    {
      {{resource_name}}: {
        {{required_attribute}}: nil
      }
    }
  end

  # Authentication helper
  before do
    sign_in({{user_name}})
  end

  describe 'GET /{{resources}}' do
    let!(:{{resources}}) { create_list(:{{factory_name}}, 3, {{attributes}}) }

    it 'returns success status' do
      get {{resources_path}}

      expect(response).to have_http_status(:ok)
    end

    it 'returns all {{resources}}' do
      get {{resources_path}}

      json_response = JSON.parse(response.body)
      expect(json_response.size).to eq(3)
    end

    it 'includes correct attributes' do
      get {{resources_path}}

      json_response = JSON.parse(response.body)
      expect(json_response.first).to include(
        'id' => {{resources}}.first.id,
        '{{attribute}}' => {{resources}}.first.{{attribute}}
      )
    end

    context 'with filtering' do
      let!(:{{filtered_resource}}) { create(:{{factory_name}}, {{filter_attribute}}: {{filter_value}}) }

      it 'returns filtered results' do
        get {{resources_path}}, params: { {{filter_param}}: {{filter_value}} }

        json_response = JSON.parse(response.body)
        expect(json_response.size).to eq(1)
        expect(json_response.first['id']).to eq({{filtered_resource}}.id)
      end
    end

    context 'with pagination' do
      let!(:{{many_resources}}) { create_list(:{{factory_name}}, 25) }

      it 'paginates results' do
        get {{resources_path}}, params: { page: 1, per_page: 10 }

        json_response = JSON.parse(response.body)
        expect(json_response.size).to eq(10)
      end

      it 'includes pagination headers' do
        get {{resources_path}}, params: { page: 2, per_page: 10 }

        expect(response.headers['X-Total-Count']).to eq('25')
        expect(response.headers['X-Page']).to eq('2')
      end
    end

    context 'when not authenticated' do
      before { sign_out }

      it 'returns unauthorized status' do
        get {{resources_path}}

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /{{resources}}/:id' do
    it 'returns success status' do
      get {{resource_path}}({{resource_name}})

      expect(response).to have_http_status(:ok)
    end

    it 'returns the {{resource}}' do
      get {{resource_path}}({{resource_name}})

      json_response = JSON.parse(response.body)
      expect(json_response['id']).to eq({{resource_name}}.id)
      expect(json_response['{{attribute}}']).to eq({{resource_name}}.{{attribute}})
    end

    context 'when {{resource}} does not exist' do
      it 'returns not found status' do
        get {{resource_path}}(id: 'nonexistent')

        expect(response).to have_http_status(:not_found)
      end

      it 'returns error message' do
        get {{resource_path}}(id: 'nonexistent')

        json_response = JSON.parse(response.body)
        expect(json_response['error']).to include('not found')
      end
    end

    context 'when user lacks permission' do
      let(:{{other_user}}) { create(:{{user_factory}}) }
      let(:{{private_resource}}) { create(:{{factory_name}}, user: {{other_user}}, private: true) }

      it 'returns forbidden status' do
        get {{resource_path}}({{private_resource}})

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'POST /{{resources}}' do
    context 'with valid parameters' do
      it 'creates a new {{resource}}' do
        expect {
          post {{resources_path}}, params: {{valid_params}}
        }.to change({{ResourceClass}}, :count).by(1)
      end

      it 'returns created status' do
        post {{resources_path}}, params: {{valid_params}}

        expect(response).to have_http_status(:created)
      end

      it 'returns the created {{resource}}' do
        post {{resources_path}}, params: {{valid_params}}

        json_response = JSON.parse(response.body)
        expect(json_response['{{attribute}}']).to eq({{valid_params}}[:{{resource_name}}][:{{attribute}}])
      end

      it 'associates {{resource}} with current user' do
        post {{resources_path}}, params: {{valid_params}}

        created_resource = {{ResourceClass}}.last
        expect(created_resource.user).to eq({{user_name}})
      end

      it 'triggers expected side effects' do
        expect {
          post {{resources_path}}, params: {{valid_params}}
        }.to have_enqueued_job({{JobClass}})
      end
    end

    context 'with invalid parameters' do
      it 'does not create a {{resource}}' do
        expect {
          post {{resources_path}}, params: {{invalid_params}}
        }.not_to change({{ResourceClass}}, :count)
      end

      it 'returns unprocessable entity status' do
        post {{resources_path}}, params: {{invalid_params}}

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it 'returns validation errors' do
        post {{resources_path}}, params: {{invalid_params}}

        json_response = JSON.parse(response.body)
        expect(json_response['errors']).to include('{{attribute}}')
      end
    end
  end

  describe 'PATCH /{{resources}}/:id' do
    context 'with valid parameters' do
      let(:{{new_attributes}}) do
        {
          {{resource_name}}: {
            {{attribute}}: {{new_value}}
          }
        }
      end

      it 'updates the {{resource}}' do
        patch {{resource_path}}({{resource_name}}), params: {{new_attributes}}

        {{resource_name}}.reload
        expect({{resource_name}}.{{attribute}}).to eq({{new_value}})
      end

      it 'returns success status' do
        patch {{resource_path}}({{resource_name}}), params: {{new_attributes}}

        expect(response).to have_http_status(:ok)
      end

      it 'returns the updated {{resource}}' do
        patch {{resource_path}}({{resource_name}}), params: {{new_attributes}}

        json_response = JSON.parse(response.body)
        expect(json_response['{{attribute}}']).to eq({{new_value}})
      end
    end

    context 'with invalid parameters' do
      it 'does not update the {{resource}}' do
        original_value = {{resource_name}}.{{attribute}}
        patch {{resource_path}}({{resource_name}}), params: {{invalid_params}}

        {{resource_name}}.reload
        expect({{resource_name}}.{{attribute}}).to eq(original_value)
      end

      it 'returns unprocessable entity status' do
        patch {{resource_path}}({{resource_name}}), params: {{invalid_params}}

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe 'DELETE /{{resources}}/:id' do
    let!(:{{resource_to_delete}}) { create(:{{factory_name}}) }

    it 'destroys the {{resource}}' do
      expect {
        delete {{resource_path}}({{resource_to_delete}})
      }.to change({{ResourceClass}}, :count).by(-1)
    end

    it 'returns no content status' do
      delete {{resource_path}}({{resource_to_delete}})

      expect(response).to have_http_status(:no_content)
    end

    it 'cascades deletion to associated records' do
      {{associated_record}} = create(:{{association_factory}}, {{resource_name}}: {{resource_to_delete}})

      expect {
        delete {{resource_path}}({{resource_to_delete}})
      }.to change({{AssociatedClass}}, :count).by(-1)
    end
  end
end
```

## Configuration Files

### rails_helper.rb

```ruby
# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'
require 'factory_bot_rails'

# Configure Database Cleaner
require 'database_cleaner/active_record'

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  # FactoryBot
  config.include FactoryBot::Syntax::Methods

  # Database Cleaner
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
  end

  config.before(:each, js: true) do
    DatabaseCleaner.strategy = :truncation
  end

  config.before(:each) do
    DatabaseCleaner.start
  end

  config.after(:each) do
    DatabaseCleaner.clean
  end

  # Request spec helpers
  config.include Devise::Test::IntegrationHelpers, type: :request
end
```

### Example FactoryBot Factory

```ruby
# spec/factories/{{resources}}.rb
FactoryBot.define do
  factory :{{factory_name}} do
    {{attribute}} { {{Faker::Type.value}} }
    {{another_attribute}} { {{value}} }

    association :{{association_name}}

    trait :{{trait_name}} do
      {{attribute}} { {{special_value}} }
    end

    trait :with_{{associations}} do
      after(:create) do |{{resource}}, evaluator|
        create_list(:{{association_factory}}, 3, {{resource_name}}: {{resource}})
      end
    end
  end
end
```

## Adaptation Rules

- [ ] Replace `{{ControllerName}}` with your controller name (PascalCase)
- [ ] Replace `{{resource_name}}`, `{{resources}}` with resource names
- [ ] Update factory names to match your FactoryBot factories
- [ ] Add authentication/authorization tests appropriate to your app
- [ ] Test all CRUD operations your controller implements
- [ ] Add edge cases for your specific domain
- [ ] Configure database_cleaner for your database type
- [ ] Test JSON/XML response formats as needed
- [ ] Add tests for custom controller actions
- [ ] Test different user roles/permissions

## Related

- Rule: @rules/rails-testing.md
- Template: @templates/rspec/basic_unit_spec.rb (for model unit tests)
- Decision: @decision-trees/integration-test-scope.md

## Example: Articles API Integration Test

```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ArticlesController, type: :request do
  let(:user) { create(:user) }
  let(:article) { create(:article, user: user) }
  let(:valid_params) do
    {
      article: {
        title: 'Test Article',
        body: 'This is a test article body',
        published: true
      }
    }
  end
  let(:invalid_params) do
    {
      article: {
        title: nil,
        body: 'Body without title'
      }
    }
  end

  before { sign_in(user) }

  describe 'GET /articles' do
    let!(:articles) { create_list(:article, 3, user: user) }
    let!(:draft_article) { create(:article, :draft, user: user) }

    it 'returns success status' do
      get articles_path

      expect(response).to have_http_status(:ok)
    end

    it 'returns published articles only' do
      get articles_path

      json_response = JSON.parse(response.body)
      expect(json_response.size).to eq(3)
    end

    context 'with include_drafts parameter' do
      it 'includes draft articles' do
        get articles_path, params: { include_drafts: true }

        json_response = JSON.parse(response.body)
        expect(json_response.size).to eq(4)
      end
    end

    context 'when not authenticated' do
      before { sign_out }

      it 'returns only public articles' do
        public_article = create(:article, :public)

        get articles_path

        json_response = JSON.parse(response.body)
        expect(json_response.size).to eq(1)
        expect(json_response.first['id']).to eq(public_article.id)
      end
    end
  end

  describe 'GET /articles/:id' do
    it 'returns the article' do
      get article_path(article)

      json_response = JSON.parse(response.body)
      expect(json_response['id']).to eq(article.id)
      expect(json_response['title']).to eq(article.title)
    end

    it 'increments view count' do
      expect {
        get article_path(article)
      }.to change { article.reload.view_count }.by(1)
    end

    context 'when article belongs to another user' do
      let(:other_user) { create(:user) }
      let(:private_article) { create(:article, user: other_user, published: false) }

      it 'returns forbidden status' do
        get article_path(private_article)

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'POST /articles' do
    context 'with valid parameters' do
      it 'creates a new article' do
        expect {
          post articles_path, params: valid_params
        }.to change(Article, :count).by(1)
      end

      it 'returns created status' do
        post articles_path, params: valid_params

        expect(response).to have_http_status(:created)
      end

      it 'enqueues notification job' do
        expect {
          post articles_path, params: valid_params
        }.to have_enqueued_job(NotifyFollowersJob)
      end
    end

    context 'with invalid parameters' do
      it 'does not create an article' do
        expect {
          post articles_path, params: invalid_params
        }.not_to change(Article, :count)
      end

      it 'returns validation errors' do
        post articles_path, params: invalid_params

        json_response = JSON.parse(response.body)
        expect(json_response['errors']['title']).to include("can't be blank")
      end
    end
  end

  describe 'PATCH /articles/:id' do
    it 'updates the article' do
      patch article_path(article), params: { article: { title: 'Updated Title' } }

      article.reload
      expect(article.title).to eq('Updated Title')
    end

    it 'creates an audit log entry' do
      expect {
        patch article_path(article), params: { article: { title: 'Updated' } }
      }.to change(AuditLog, :count).by(1)
    end
  end

  describe 'DELETE /articles/:id' do
    let!(:article_to_delete) { create(:article, user: user) }

    it 'soft deletes the article' do
      delete article_path(article_to_delete)

      expect(article_to_delete.reload).to be_deleted
    end

    it 'does not actually destroy the record' do
      expect {
        delete article_path(article_to_delete)
      }.not_to change(Article, :count)
    end
  end
end
```

## Notes

### Database Cleaner Strategy

Choose the right strategy:
- **Transaction**: Fast, rolls back after each test (default)
- **Truncation**: Slower, actually deletes data (use for JS tests)
- **Deletion**: Middle ground, uses DELETE statements

### FactoryBot Best Practices

```ruby
# ✅ Good: Use traits for variations
create(:article, :published)
create(:article, :with_comments)

# ✅ Good: Override specific attributes
create(:article, title: 'Custom Title')

# ❌ Avoid: Creating records you don't use
let!(:unused_article) { create(:article) }

# ✅ Better: Use let (lazy) unless you need let! (eager)
let(:article) { create(:article) }
```

### Testing Response Structure

```ruby
# Test status codes
expect(response).to have_http_status(:ok)         # 200
expect(response).to have_http_status(:created)    # 201
expect(response).to have_http_status(:no_content) # 204
expect(response).to have_http_status(:unauthorized) # 401
expect(response).to have_http_status(:forbidden)  # 403
expect(response).to have_http_status(:not_found)  # 404
expect(response).to have_http_status(:unprocessable_entity) # 422

# Test response body
json = JSON.parse(response.body)
expect(json['key']).to eq('value')
expect(json).to include('key' => 'value')
```

### Authentication Patterns

```ruby
# Devise
config.include Devise::Test::IntegrationHelpers, type: :request
sign_in(user)
sign_out

# JWT or custom auth
headers = { 'Authorization' => "Bearer #{token}" }
get articles_path, headers: headers
```
