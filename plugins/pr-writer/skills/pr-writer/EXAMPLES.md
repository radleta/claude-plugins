# PR Writer Examples

This file contains real-world examples of pull requests following best practices, as well as anti-patterns to avoid.

## Table of Contents
1. [Simple PR Examples (Minimal Template)](#simple-pr-examples-minimal-template)
2. [Complete PR Examples](#complete-pr-examples)
3. [Title Examples](#title-examples)
4. [Description Examples](#description-examples)
5. [Breaking Change Examples](#breaking-change-examples)
6. [Testing Documentation Examples](#testing-documentation-examples)
7. [Bad PR Examples (Anti-patterns)](#bad-pr-examples-anti-patterns)

---

## Simple PR Examples (Minimal Template)

**Remember: Most PRs should be simple!** Don't add unnecessary sections.

### Example 1: Simple Bug Fix

**Title:**
```
fix: correct email validation regex pattern
```

**Description:**
```markdown
## Summary
Fixes email validation to accept plus signs (+) in email addresses (e.g., user+tag@example.com).

Fixes #789

## Testing
- [x] Added unit test for email with plus sign
- [x] All existing tests pass
- [x] Manually tested with test+user@example.com
```

**Why this is good:**
- Clear and concise (< 50 words)
- Explains what was fixed
- Shows it was tested
- No unnecessary sections

---

### Example 2: Documentation Update

**Title:**
```
docs: add Windows installation instructions to README
```

**Description:**
```markdown
## Summary
Adds installation instructions for Windows users to the README, including PowerShell commands and common troubleshooting tips.

Closes #456

## Testing
- [x] Verified all links work
- [x] Tested commands on Windows 11
```

**Why this is good:**
- Simple and to the point
- No unnecessary "Implementation" or "Motivation" sections
- Focus on what matters: what changed and that it was verified

---

### Example 3: Small Refactor

**Title:**
```
refactor: extract email validation to utility function
```

**Description:**
```markdown
## Summary
Extracts duplicated email validation logic from 3 controllers into a shared utility function.

## Testing
- [x] All existing tests pass (behavior unchanged)
- [x] No new tests needed (pure refactoring)
```

**Why this is good:**
- Explains the refactor purpose
- Notes that behavior is unchanged
- No verbose "before/after" code blocks for simple changes
- Testing section confirms safety

---

## Complete PR Examples

### Example 1: Feature Addition (Frontend)

**Title:**
```
feat(profile): add user profile edit functionality (#234)
```

**Description:**
```markdown
## Summary
This PR implements the user profile edit functionality, allowing users to update their name, email, and avatar. This completes the profile management feature set.

Closes #234
Related to #189 (profile view)

## Motivation
Users have been requesting the ability to update their profile information since launch. Currently, users must contact support to change basic info, which:
- Creates unnecessary support burden (avg 15 tickets/week)
- Provides poor user experience
- Blocks users from fixing typos or updating outdated information

## Implementation
Added a new profile edit page with the following features:
- **Form validation** - Client-side validation with immediate feedback
- **Avatar upload** - Using presigned S3 URLs for secure direct uploads
- **Optimistic updates** - UI updates immediately while saving in background
- **Rate limiting** - Max 5 profile updates per hour to prevent abuse

### Key Changes
- `components/ProfileEditForm.tsx` - New form component with field validation
- `services/UserService.ts` - Added `updateProfile()` and `uploadAvatar()` methods
- `api/profile.ts` - New API endpoints for profile updates
- `hooks/useProfileUpdate.ts` - Custom hook managing update state

### Design Decisions
1. **Why optimistic updates?**
   - Better perceived performance (instant feedback)
   - Can still show errors if save fails
   - Common pattern in modern apps

2. **Why separate avatar upload?**
   - Profile updates succeed even if avatar upload fails
   - Allows retry of just the avatar without re-saving profile
   - Reduces server load (direct S3 upload)

3. **Why rate limiting?**
   - Prevents potential abuse (spam, malicious updates)
   - Protects against buggy clients making infinite requests
   - 5/hour is generous for legitimate use

### Areas for Review
- 🔍 Please review the validation logic in `ProfileEditForm.tsx` lines 45-78
- 🔍 Security review of avatar upload flow (using presigned URLs)
- 🔍 Error handling for network failures (lines 120-135)

## Testing

### Automated Tests
- [x] Unit tests for ProfileEditForm validation
- [x] Unit tests for UserService methods
- [x] Integration tests for API endpoints
- [x] All existing tests pass

### Manual Testing
- [x] Tested on Chrome 120, Firefox 121, Safari 17
- [x] Tested responsive design (mobile, tablet, desktop)
- [x] Tested with slow 3G network (Chrome DevTools throttling)
- [x] Tested keyboard navigation and screen reader (NVDA)
- [x] Verified error messages are clear and helpful

### Steps to Test
1. **Happy Path:**
   - Log in as test user (test@example.com / password123)
   - Navigate to Profile → Edit Profile
   - Update name field to "Test User Updated"
   - Click Save
   - ✅ Verify name updates in header immediately
   - ✅ Verify success toast appears
   - ✅ Verify changes persist after page refresh

2. **Avatar Upload:**
   - Click "Change Avatar" button
   - Select an image file (JPG/PNG, < 5MB)
   - ✅ Verify preview shows immediately
   - ✅ Verify avatar updates after upload completes
   - ✅ Try with 10MB file → verify error message
   - ✅ Try with invalid file type → verify error message

3. **Error Handling:**
   - Disconnect network (DevTools offline)
   - Try to save changes
   - ✅ Verify error message explains the issue
   - ✅ Verify form data is preserved (not lost)
   - Reconnect network and retry
   - ✅ Verify save succeeds

4. **Rate Limiting:**
   - Make 5 profile updates in quick succession
   - Try 6th update
   - ✅ Verify rate limit error message
   - Wait 1 hour or reset in database
   - ✅ Verify updates work again

## Screenshots

### Edit Profile Page
![Profile Edit Form](https://user-images.example.com/profile-edit.png)

### Validation States
![Validation Errors](https://user-images.example.com/validation.png)

### Success State
![Success Message](https://user-images.example.com/success.png)

### Avatar Upload Flow
![Avatar Upload](https://user-images.example.com/avatar-upload.gif)

## Performance Impact
- **Page load:** No impact (lazy loaded)
- **Bundle size:** +8KB (gzipped) - mostly from validation library
- **API calls:** 1-2 per save (profile + optional avatar)

## Accessibility
- All form fields have proper labels
- Error messages are announced by screen readers
- Keyboard navigation works throughout
- Color contrast meets WCAG AA standards
- Focus states are clearly visible

## Security Considerations
- Avatar uploads use presigned S3 URLs (no server passthrough)
- Input validation on both client and server
- Rate limiting prevents abuse
- File type validation prevents malicious uploads
- Max file size enforced (5MB)

## Dependencies
- Added: `react-hook-form@7.49.0` - Form state management
- Added: `zod@3.22.0` - Schema validation

## Rollback Plan
If issues arise:
1. Revert this PR (single commit, clean revert)
2. No database migrations, so no rollback needed
3. Feature is behind no feature flag (consider adding)
4. Users will return to previous "contact support" flow

## Additional Notes
- Future enhancement: Add email verification for email changes (see #345)
- Future enhancement: Add profile change history audit log (see #346)
- Known limitation: Avatar uploads fail in IE11 (unsupported browser)
```

---

### Example 2: Bug Fix (Backend)

**Title:**
```
fix: prevent race condition in cache invalidation (#892)
```

**Description:**
```markdown
## Summary
Fixes a race condition where the cache was being read before invalidation completed, causing stale data to be served to users.

Fixes #892

## Problem
When a user updates their profile, we:
1. Update database
2. Invalidate cache (async)
3. Return response to client
4. Client immediately fetches updated profile

However, step 4 was happening before step 2 completed, so users saw their old profile data even after a successful update.

**Reproduction:**
- Update profile with network latency
- Immediately refresh profile page
- ~40% of the time, old data appears

## Root Cause
```typescript
// Before (buggy code)
await db.updateProfile(userId, data);
cache.invalidate(`profile:${userId}`); // No await!
return res.json({ success: true });
```

The `cache.invalidate()` method is async but we weren't awaiting it, so it ran in the background while the response was sent.

## Solution
```typescript
// After (fixed code)
await db.updateProfile(userId, data);
await cache.invalidate(`profile:${userId}`); // Now awaited
return res.json({ success: true });
```

Simply await the cache invalidation to ensure it completes before responding.

## Testing
- [x] Added regression test to verify cache invalidation
- [x] Tested manually with 50 consecutive updates - no stale data
- [x] Load tested with 1000 concurrent updates - all successful

### Test Added
```typescript
it('should invalidate cache before responding', async () => {
  await updateProfile(userId, { name: 'New Name' });
  const cached = await cache.get(`profile:${userId}`);
  expect(cached).toBeNull(); // Cache must be empty
});
```

## Performance Impact
- **Before:** 45ms average response time
- **After:** 48ms average response time (+3ms)
- **Why:** We now wait for Redis invalidation (~3ms) before responding
- **Tradeoff:** 3ms slower but 100% consistent data (worth it)

## Deployment Notes
- No database migrations needed
- No config changes needed
- Safe to deploy immediately
- Monitor cache hit rates post-deploy
```

---

### Example 3: Refactoring PR

**Title:**
```
refactor: extract validation logic to separate module
```

**Description:**
```markdown
## Summary
Extracts scattered validation logic from controllers into a centralized `validators/` module. This is pure refactoring with **zero behavior changes**.

Related to #567 (improving code maintainability)

## Motivation
Validation logic is currently duplicated across 12 different controllers:
- Hard to maintain (changes need to be made in multiple places)
- Inconsistent error messages
- Difficult to test in isolation
- Violates DRY principle

## Changes
- Created `src/validators/` directory with reusable validators
- Moved validation logic from controllers to validators
- Updated controllers to use new validators
- **All tests pass without changes** (proving behavior is identical)

### File Changes
- **New:** `src/validators/user.validator.ts` - User input validation
- **New:** `src/validators/post.validator.ts` - Post input validation
- **New:** `src/validators/common.validator.ts` - Shared validators (email, phone, etc.)
- **Modified:** 12 controller files - Replaced inline validation with validator calls

## Code Examples

### Before
```typescript
// In UserController.ts
async createUser(req, res) {
  // Inline validation
  if (!req.body.email || !req.body.email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!req.body.password || req.body.password.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }
  // ... more validation ...

  const user = await db.createUser(req.body);
  return res.json(user);
}
```

### After
```typescript
// In UserController.ts (clean!)
async createUser(req, res) {
  const validation = validateUserCreate(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  const user = await db.createUser(req.body);
  return res.json(user);
}

// In validators/user.validator.ts (reusable!)
export function validateUserCreate(data) {
  if (!data.email || !data.email.includes('@')) {
    return { success: false, error: 'Invalid email' };
  }
  if (!data.password || data.password.length < 8) {
    return { success: false, error: 'Password too short' };
  }
  return { success: true };
}
```

## Testing
- [x] All 847 existing tests pass without modification
- [x] No new tests needed (behavior unchanged)
- [x] Verified manually that error messages are identical
- [x] Checked that response codes are unchanged

### Proof of No Behavior Change
Running full test suite before and after:
```bash
# Before refactor
✓ 847 passing

# After refactor
✓ 847 passing
```

## Benefits
1. **DRY:** Validation logic defined once, used everywhere
2. **Testable:** Can test validators in isolation
3. **Consistent:** Same validation logic = same error messages
4. **Maintainable:** Changes made in one place
5. **Readable:** Controllers are cleaner, easier to understand

## Future Work
This refactor enables:
- [ ] Switching to Zod for schema validation (#568)
- [ ] Adding OpenAPI schema generation (#569)
- [ ] Consistent i18n error messages (#570)

## Deployment
- Zero risk (no behavior changes)
- No database changes
- No config changes
- Can deploy anytime
```

---

### Example 4: Performance Improvement

**Title:**
```
perf: optimize dashboard queries (67% faster load time)
```

**Description:**
```markdown
## Summary
Optimizes database queries on the dashboard page, reducing load time from 2.4s to 0.8s (67% improvement).

Closes #445

## Problem
Dashboard page was loading slowly (2.4s avg) due to:
1. **N+1 queries:** Loading users, then loading role for each user separately (12 queries)
2. **Missing indexes:** Filtering by created_at without index
3. **Unnecessary data:** Fetching full user objects when only needing name + email

## Solution

### 1. Fixed N+1 Query
**Before:**
```typescript
const users = await db.getUsers(); // 1 query
for (const user of users) {
  user.role = await db.getRole(user.roleId); // N queries
}
```

**After:**
```typescript
const users = await db.getUsersWithRoles(); // 1 query with JOIN
```

### 2. Added Database Index
```sql
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 3. Select Only Needed Columns
**Before:**
```sql
SELECT * FROM users WHERE created_at > '2024-01-01';
```

**After:**
```sql
SELECT id, name, email FROM users WHERE created_at > '2024-01-01';
```

## Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Page load time | 2.4s | 0.8s | **67% faster** |
| Database queries | 12 | 3 | **75% reduction** |
| Data transferred | 45KB | 12KB | **73% reduction** |
| DB CPU usage | 23% | 8% | **65% reduction** |

### Benchmarks
Tested with:
- 1,000 users in database
- 10 concurrent requests
- Ran 100 iterations, averaged results

**Load time distribution:**
- p50: 0.8s (was 2.3s)
- p95: 1.2s (was 3.8s)
- p99: 1.5s (was 4.5s)

## Testing
- [x] All existing tests pass
- [x] Added test for getUsersWithRoles query
- [x] Verified query plan using EXPLAIN ANALYZE
- [x] Load tested with 1000 concurrent users
- [x] Manually tested dashboard in staging

## Database Migration
```sql
-- migrations/20240115_add_users_index.sql
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);
```

Using `CONCURRENTLY` to avoid locking table during index creation (safe for production).

## Deployment Plan
1. Run database migration (non-blocking, ~30s)
2. Deploy new code
3. Monitor query performance in DataDog
4. Verify no regressions in error rates

## Rollback Plan
If issues arise:
1. Revert code deployment
2. Keep database index (no harm in keeping it)

## Monitoring
Watch these metrics post-deploy:
- Dashboard page load time (should drop to ~0.8s)
- Database query count (should drop to ~3)
- Error rate (should remain at <0.1%)

## Screenshots

### Before (2.4s load)
![Before Performance](https://user-images.example.com/perf-before.png)

### After (0.8s load)
![After Performance](https://user-images.example.com/perf-after.png)

### Query Plan Analysis
![EXPLAIN ANALYZE](https://user-images.example.com/explain-analyze.png)
```

---

## Title Examples

### Good Titles ✅

```
feat: add user authentication with OAuth2
fix: resolve memory leak in image cache
docs: update API authentication guide
refactor: extract validation logic to validators module
perf: optimize database queries for dashboard page
test: add integration tests for payment flow
chore: update dependencies to latest versions
ci: add automated security scanning to pipeline
style: format code with prettier
feat(auth): implement password reset flow
fix(api): handle null values in user response
feat!: migrate to v2 API endpoints (breaking change)
fix: prevent XSS vulnerability in comment rendering
perf(db): add indexes for frequently queried columns
docs(readme): add installation instructions for Windows
```

### Bad Titles ❌

```
Updates                          # Too vague
Fixed stuff                      # Not descriptive
bug fix                          # No capital, no specifics
WIP - don't merge yet           # Don't create PR until ready
Changes to the code              # Every PR changes code
Misc improvements                # What improvements?
asdf                            # Nonsense
Fixed the thing we discussed    # Not everyone was in discussion
Update file.ts                   # WHAT did you update?
PR for review                   # Every PR is for review
Final changes                    # Too vague
Cleanup                         # What was cleaned up?
```

---

## Description Examples

### Example: Minimal but Complete

For simple bug fixes, you don't need a novel. But include the essentials:

```markdown
## Summary
Fixes broken link in documentation that points to outdated API endpoint.

Fixes #789

## Changes
Updated link from `/api/v1/users` to `/api/v2/users` in README.md

## Testing
- [x] Clicked link to verify it works
- [x] Checked that v2 endpoint is correct
```

---

### Example: Feature with Context

```markdown
## Summary
Adds email notifications when a user's post receives a comment.

Closes #234

## Motivation
Users currently have no way to know when someone comments on their posts unless they manually check. This leads to:
- Delayed responses to questions
- Poor engagement
- Users feeling disconnected from their content

Analytics show users check their posts on avg 2x/week, but comments arrive daily. Email notifications will keep users engaged.

## Implementation
- Created `NotificationService` to handle email sending
- Added database table for notification preferences
- Integrated with SendGrid for email delivery
- Added unsubscribe link in all emails (CAN-SPAM compliance)

### User Flow
1. User A posts content
2. User B comments on User A's post
3. `NotificationService.sendCommentNotification()` is triggered
4. Email sent to User A with comment preview
5. User A clicks link in email → taken to post with comment

## Testing
- [x] Unit tests for NotificationService
- [x] Integration tests for comment → email flow
- [x] Manually tested with real email delivery
- [x] Tested unsubscribe link works
- [x] Verified emails render correctly in Gmail, Outlook, Apple Mail

### Test Account
Use `test+notifications@example.com` to test email delivery (check inbox).

## Configuration
Add to `.env`:
```
SENDGRID_API_KEY=<your-key>
NOTIFICATIONS_ENABLED=true
```

## Rollback Plan
Set `NOTIFICATIONS_ENABLED=false` to disable without code changes.
```

---

## Breaking Change Examples

### Example 1: API Change

```markdown
## ⚠️ Breaking Changes

### What's Breaking
The `POST /api/users` endpoint now requires email verification token.

### Before
```json
POST /api/users
{
  "email": "user@example.com",
  "password": "secretpass"
}
```

### After
```json
POST /api/users
{
  "email": "user@example.com",
  "password": "secretpass",
  "verificationToken": "abc123..."
}
```

### Migration Guide

**For API clients:**
1. Call `POST /api/verification/request` first to get token
2. Include token in user creation request
3. Update error handling for 400 errors about missing token

**Deprecation Timeline:**
- v2.0 (this release): Old endpoint returns 400 with helpful error message
- v2.1 (Feb 2025): Warning logged for old usage
- v3.0 (May 2025): Old endpoint removed entirely

### Need Help?
See full migration guide in docs/migration-v2.md or contact #api-support
```

---

### Example 2: Database Schema Change

```markdown
## ⚠️ Breaking Changes

### What's Breaking
User table schema has changed. The `name` column is now split into `first_name` and `last_name`.

### Migration Required
Run this SQL before deploying:

```sql
-- Add new columns
ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);

-- Migrate data (split existing names)
UPDATE users
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = SPLIT_PART(name, ' ', 2);

-- Drop old column (after verifying migration)
-- ALTER TABLE users DROP COLUMN name;
```

### Code Changes Required

**Before:**
```typescript
const user = await db.getUser(id);
console.log(user.name); // "John Doe"
```

**After:**
```typescript
const user = await db.getUser(id);
console.log(`${user.first_name} ${user.last_name}`); // "John Doe"
```

### Backward Compatibility
For 1 month, `name` field will be computed as `${first_name} ${last_name}` to give clients time to migrate.

### Rollback
If you need to rollback:
1. Revert code deployment
2. Keep new columns (no harm)
3. Old code will continue using `name` column
```

---

## Testing Documentation Examples

### Example 1: Frontend Feature Testing

```markdown
## Testing

### Automated Tests
- [x] Unit tests for all new components
- [x] Integration tests for user flow
- [x] Snapshot tests for UI components
- [x] E2E tests using Playwright

### Coverage
- Statements: 94% (+2%)
- Branches: 89% (+3%)
- Functions: 91% (+1%)

### Manual Testing

#### Browser Compatibility
- [x] Chrome 120 (Windows, macOS, Linux)
- [x] Firefox 121 (Windows, macOS)
- [x] Safari 17 (macOS, iOS)
- [x] Edge 120 (Windows)
- [ ] IE 11 (not supported, known limitation)

#### Responsive Design
- [x] Mobile (375px - iPhone SE)
- [x] Tablet (768px - iPad)
- [x] Desktop (1920px)
- [x] Ultra-wide (2560px)

#### Accessibility
- [x] Keyboard navigation (Tab, Enter, Esc)
- [x] Screen reader (NVDA on Windows, VoiceOver on macOS)
- [x] Color contrast (WCAG AA compliant)
- [x] Focus indicators visible
- [x] ARIA labels present

### Steps to Test

1. **Create New Post**
   - Navigate to `/posts/new`
   - Fill in title: "Test Post"
   - Fill in body: "This is a test"
   - Click "Publish"
   - ✅ Redirects to post page
   - ✅ Post appears in feed
   - ✅ Toast notification shows success

2. **Edit Existing Post**
   - Navigate to any post you own
   - Click "Edit" button
   - Change title to "Updated Title"
   - Click "Save"
   - ✅ Changes persist after page refresh
   - ✅ "Last edited" timestamp updates

3. **Delete Post**
   - Navigate to any post you own
   - Click "Delete" button
   - ✅ Confirmation modal appears
   - Click "Cancel" → ✅ Modal closes, post remains
   - Click "Delete" again → Click "Confirm"
   - ✅ Post is deleted
   - ✅ Redirects to feed
   - ✅ Post no longer appears

4. **Error Handling**
   - Try to create post with empty title
   - ✅ Validation error appears: "Title is required"
   - Try to submit form while offline (DevTools Network: Offline)
   - ✅ Error message: "Network error, please try again"
   - Reconnect and retry
   - ✅ Submission succeeds

### Test Users
- **Admin:** admin@test.com / password123
- **Regular user:** user@test.com / password123
- **New user:** Create one during testing
```

---

### Example 2: Backend API Testing

```markdown
## Testing

### Automated Tests
```bash
npm test                    # Unit tests (127 tests, all passing)
npm run test:integration    # Integration tests (43 tests, all passing)
npm run test:e2e           # E2E tests (12 tests, all passing)
```

### API Endpoint Tests

All new endpoints have test coverage:
- `POST /api/posts` - Create post (6 test cases)
- `GET /api/posts/:id` - Get post (4 test cases)
- `PUT /api/posts/:id` - Update post (7 test cases)
- `DELETE /api/posts/:id` - Delete post (5 test cases)

### Test Cases Covered

#### Create Post (`POST /api/posts`)
- [x] ✅ Valid request creates post
- [x] ❌ Missing title returns 400
- [x] ❌ Missing body returns 400
- [x] ❌ Unauthenticated request returns 401
- [x] ❌ Title > 200 chars returns 400
- [x] ✅ With optional tags creates post with tags

#### Update Post (`PUT /api/posts/:id`)
- [x] ✅ Valid request updates post
- [x] ❌ Non-existent ID returns 404
- [x] ❌ Update other user's post returns 403
- [x] ✅ Partial update works (only title)
- [x] ❌ Invalid data returns 400
- [x] ✅ Admin can update any post
- [x] ✅ Updates `updated_at` timestamp

### Manual Testing with cURL

**Create a post:**
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","body":"Test content"}'

# Expected: 201 Created with post object
```

**Get the post:**
```bash
curl http://localhost:3000/api/posts/POST_ID

# Expected: 200 OK with post object
```

**Update the post:**
```bash
curl -X PUT http://localhost:3000/api/posts/POST_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Expected: 200 OK with updated post
```

**Delete the post:**
```bash
curl -X DELETE http://localhost:3000/api/posts/POST_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 204 No Content
```

### Load Testing

Tested with Apache Bench:
```bash
ab -n 1000 -c 50 http://localhost:3000/api/posts

# Results:
# Requests per second: 847 [#/sec]
# Time per request: 59ms (mean)
# Failed requests: 0
```

### Database Testing
- [x] Migration runs successfully (up and down)
- [x] Constraints prevent invalid data
- [x] Indexes improve query performance
- [x] Foreign keys maintain referential integrity
```

---

## Bad PR Examples (Anti-patterns)

### ❌ Bad Example 1: No Description

**Title:** `fix: bug fix`

**Description:** *(empty)*

**Why it's bad:**
- No context about what bug was fixed
- No explanation of root cause
- No testing information
- Reviewers have to dig through code to understand changes
- Hard to reference later ("what did this PR fix?")

---

### ❌ Bad Example 2: Vague Description

**Title:** `Updates`

**Description:**
```
Made some changes to improve things. Please review.
```

**Why it's bad:**
- Title is meaningless
- "Some changes" tells reviewer nothing
- "Improve things" - what things? How?
- No testing info
- No context or motivation

---

### ❌ Bad Example 3: Too Large

**Title:** `feat: complete rewrite of user system`

**Description:**
```
Rewrote the entire user authentication, authorization, and profile management system.

Changes:
- New auth system
- New database schema
- New API endpoints
- New frontend components
- Updated tests
- Migrated existing users

Please review!
```

**Files changed:** 147 files, +8,234 −4,567 lines

**Why it's bad:**
- Way too large (should be 10-20 smaller PRs)
- Impossible to review properly in reasonable time
- High risk - too many changes at once
- Hard to revert if problems found
- Mixed concerns (auth, profile, migration, etc.)
- Likely to have long feedback cycles

**How to fix:** Break into incremental PRs:
1. Add new auth system (behind feature flag)
2. Add database migrations
3. Update API endpoints
4. Update frontend components
5. Migrate existing users
6. Remove old system

---

### ❌ Bad Example 4: Missing Tests

**Title:** `feat: add payment processing`

**Description:**
```
Added Stripe payment integration. Users can now purchase subscriptions.

Implementation:
- Added Stripe SDK
- Created payment API endpoints
- Added payment form to frontend
```

**Testing:** *(section missing)*

**Why it's bad:**
- No mention of testing for critical payment functionality
- Payment processing should have extensive testing
- No security review mentioned
- No error handling details
- Missing information about test mode vs live mode

---

### ❌ Bad Example 5: Defensive/Hostile Tone

**Title:** `fix: revert stupid changes from PR #123`

**Description:**
```
Reverting the terrible changes from #123 that broke everything. I told them this wouldn't work but they merged it anyway. This fixes all the problems they created.

Obviously I had to rewrite their code properly.
```

**Why it's bad:**
- Hostile, unprofessional tone
- Attacks other developers
- "I told you so" attitude
- Doesn't explain what was actually wrong
- Creates toxic team environment
- Reduces collaboration

**How to fix:**
```
fix: resolve regression in user authentication

PR #123 introduced a regression where users with special characters in their
email couldn't log in. This PR fixes the issue by properly escaping email
addresses in the authentication query.

Root cause: Email addresses weren't being URL-encoded before comparison.

Fixes #456
Related to #123
```

---

### ❌ Bad Example 6: "Works on My Machine"

**Title:** `fix: login issue`

**Description:**
```
Fixed the login problem. Works fine now.
```

**Testing:**
```
Tested on my laptop and it works.
```

**Why it's bad:**
- No details about what was broken
- No explanation of fix
- "Works on my laptop" doesn't mean it works everywhere
- No cross-browser, cross-platform testing
- No automated tests mentioned
- No reproduction steps for the original bug

---

### ❌ Bad Example 7: Work In Progress

**Title:** `WIP: new feature (don't merge yet!!!)`

**Description:**
```
Still working on this but wanted to get early feedback.

TODO:
- [ ] Finish implementation
- [ ] Add tests
- [ ] Update docs
- [ ] Fix all the bugs
- [ ] Actually make it work

Don't review yet, I'll ping when ready.
```

**Why it's bad:**
- Don't create a PR until it's ready for review
- Use draft PRs if you need early feedback
- Clutters team's PR queue with not-ready work
- Wastes reviewer time if they miss "don't review"
- "Actually make it work" suggests broken code

**How to fix:** Use GitHub's "Draft PR" feature for work in progress.

---

### ❌ Bad Example 8: No Context for Reviewers

**Title:** `refactor: improve code quality`

**Description:**
```
Refactored some code to make it better.

Files changed:
- utils/helper.ts
- services/user.ts
- controllers/auth.ts
```

**Why it's bad:**
- "Make it better" - how? Why?
- No explanation of what was wrong before
- No explanation of what's better now
- Reviewers can't evaluate if refactor is good without context
- Could be personal preference rather than improvement

**How to fix:**
```
refactor: extract duplicated validation logic

The same email validation logic was copy-pasted in 8 different files,
making it hard to maintain and leading to inconsistencies.

This PR extracts the validation into a shared utility function.

Benefits:
- Single source of truth for email validation
- Easier to update validation rules
- Reduced code duplication (removed 47 duplicate lines)
- More testable (can test validation in isolation)
```

---

### ❌ Bad Example 9: Screenshot Overload (No Description)

**Title:** `UI updates`

**Description:**
```
Made some UI changes. See screenshots below.
```

*(Includes 30 screenshots with no labels or context)*

**Why it's bad:**
- Screenshots without context don't explain WHAT or WHY
- 30 unlabeled screenshots is overwhelming
- No written description of changes
- Reviewers don't know what they're looking at
- No testing information

**How to fix:**
- Write proper What/Why/How description
- Include 3-5 labeled screenshots showing key changes
- Annotate screenshots to highlight specific changes
- Use before/after comparisons

---

### ❌ Bad Example 10: Commit Message as Description

**Title:** `feat: user dashboard`

**Description:**
```
feat: add dashboard component
fix: css issue
update: change color
fix: typo
refactor: rename variable
fix: another bug
update: final changes
```

**Why it's bad:**
- Just copy-pasted commit messages
- Commit messages should describe individual commits, not the PR
- No high-level overview of the feature
- No context or motivation
- Messy commit history suggests poor development process

**How to fix:** Write a proper PR description with What/Why/How, and clean up commits (squash or rewrite).

---

## Key Takeaways

### Good PRs are:
✅ Small and focused
✅ Well-documented with clear descriptions
✅ Thoroughly tested with evidence
✅ Easy to review and understand
✅ Professional and collaborative

### Bad PRs are:
❌ Large and unfocused
❌ Poorly documented or missing context
❌ Lacking tests or testing info
❌ Confusing or hard to review
❌ Defensive, hostile, or unprofessional

**Remember:** A PR is communication. Write it like you're explaining your changes to a smart colleague who wasn't in the room when you made the decisions.
