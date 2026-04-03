# Coverage Strategy Decision Tree

## When to Use This Tree

Use this tree when deciding **what coverage target to aim for** and **which coverage metrics matter** for your project. Coverage is a necessary but insufficient measure of test quality - the right strategy depends on your project's risk profile, industry, and module criticality.

## The Core Question

**"What coverage target should I aim for, and which coverage types should I measure?"**

---

## The Decision Tree

```
Start: What type of project is this?

├─ Safety-critical system (medical, aerospace, automotive)?
│   │
│   ├─ Regulatory requirement (FDA, DO-178C, ISO 26262)?
│   │   └─ → 95-100% line + branch coverage + MC/DC
│   │       (Modified Condition/Decision Coverage required)
│   │
│   └─ Life-safety concern but not regulated?
│       └─ → 90-95% line + branch + 80% mutation score
│
├─ Financial/payment system?
│   │
│   ├─ Handles payments, transactions, money movement?
│   │   └─ → 80-90% line + 70-80% branch + mutation testing
│   │       (PCI-DSS, SOX compliance expected)
│   │
│   └─ Financial reporting/analytics only?
│       └─ → 70-80% line + 60% branch
│
├─ Enterprise SaaS / Cloud service?
│   │
│   ├─ Business-critical operations (CRM, ERP)?
│   │   └─ → 70-80% line + 60% branch
│   │
│   ├─ Standard web application?
│   │   └─ → 60-70% line + 50% branch
│   │
│   └─ Internal tools / admin panels?
│       └─ → 40-60% line + 40% branch
│
├─ Consumer mobile app / Web app?
│   │
│   ├─ Fast iteration priority, competitive market?
│   │   └─ → 50-70% line + 40-50% branch
│   │
│   └─ Established product, slower release cycle?
│       └─ → 60-75% line + 50% branch
│
├─ Open-source library / SDK / Framework?
│   │
│   ├─ Public API surface (used by many projects)?
│   │   └─ → 85-95% line + 75-85% branch + mutation testing
│   │       (Users expect high quality, breaking changes costly)
│   │
│   └─ Small utility library?
│       └─ → 80-90% line + 70% branch
│
└─ Prototype / MVP / Proof-of-concept?
    │
    ├─ Requirements unclear, exploratory phase?
    │   └─ → 20-40% line coverage (focus on core flows only)
    │
    └─ MVP approaching production?
        └─ → 50-60% line + 40% branch (validate critical paths)
```

---

## Module-Specific Coverage Strategy

Even within a single project, different modules need different coverage:

```
Start: What module are you testing?

├─ Authentication / Authorization / Security?
│   └─ → 85-95% line + 75-85% branch + mutation testing
│       (Security bugs catastrophic, test thoroughly)
│
├─ Payment processing / Money movement?
│   └─ → 85-95% line + 75-85% branch + mutation testing
│       (Financial loss, regulatory risk)
│
├─ Core business logic / Domain models?
│   └─ → 75-85% line + 65-75% branch
│       (Represents business value, moderate complexity)
│
├─ API endpoints / Service layer?
│   └─ → 70-80% line + 60-70% branch
│       (Integration points, medium risk)
│
├─ Database migrations / Schema changes?
│   └─ → Test up/down migrations, data integrity
│       (Coverage less important than correctness)
│
├─ UI components / Views?
│   │
│   ├─ Complex interactive components (data tables, forms)?
│   │   └─ → 60-70% line + 50% branch
│   │
│   └─ Simple presentational components?
│       └─ → 40-50% line (focus on user interactions)
│
├─ Utilities / Helpers / Pure functions?
│   └─ → 85-95% line + 80% branch + mutation testing
│       (Simple to test, high leverage)
│
├─ Configuration / Constants / Types?
│   └─ → Skip coverage (no logic to test)
│
└─ Internal admin tools / Developer tooling?
    └─ → 30-50% line (lower priority, internal users)
```

---

## Coverage Type Selection

```
Start: Which coverage metrics should I track?

├─ Required baseline for ALL projects
│   └─ → Line coverage + Branch coverage
│       (Minimum viable metrics)
│
├─ Additional metrics for HIGH-RISK code
│   │
│   ├─ Complex conditional logic (nested if/else, switch)?
│   │   └─ → Add Condition Coverage
│   │       (Tests all boolean sub-expressions)
│   │
│   ├─ Safety-critical systems?
│   │   └─ → Add MC/DC (Modified Condition/Decision Coverage)
│   │       (Regulatory requirement for DO-178C, ISO 26262)
│   │
│   └─ Want to validate test effectiveness?
│       └─ → Add Mutation Testing
│           (Verifies tests actually catch bugs)
│
└─ Advanced metrics for SPECIALIZED needs
    │
    ├─ Complex algorithms with many paths?
    │   └─ → Add Path Coverage (for critical functions only)
    │       (Exponential paths, expensive to achieve)
    │
    ├─ State machines / Workflow engines?
    │   └─ → State Coverage + Transition Coverage
    │       (Verify all states and transitions tested)
    │
    └─ Public APIs / SDKs?
        └─ → API Coverage (track which endpoints tested)
```

---

## Code Examples for Each Coverage Strategy

### Example 1: Safety-Critical System (95-100% Coverage)

**Context:** Medical device firmware - pacemaker controller

```c
// Pacemaker heart rate controller - REQUIRES 100% MC/DC coverage
int calculate_pacing_interval(int heart_rate, PatientProfile* patient) {
    // Every branch MUST be tested (life-safety critical)

    if (heart_rate < patient->min_heart_rate) {
        // Branch 1: Heart rate too low
        if (patient->pacemaker_mode == MODE_DEMAND) {
            // Branch 1a: Demand mode
            return calculate_demand_interval(patient);
        } else {
            // Branch 1b: Fixed rate mode
            return patient->fixed_interval;
        }
    } else if (heart_rate > patient->max_heart_rate) {
        // Branch 2: Heart rate too high (tachycardia)
        trigger_alert(ALERT_TACHYCARDIA);
        return patient->safety_interval;
    } else {
        // Branch 3: Heart rate normal
        return NO_PACING_REQUIRED;
    }
}

// Test suite - MUST achieve 100% branch coverage + MC/DC
TEST(PacemakerController, BelowMinHeartRateDemandMode) {
    PatientProfile patient = {
        .min_heart_rate = 60,
        .pacemaker_mode = MODE_DEMAND
    };

    int interval = calculate_pacing_interval(50, &patient);

    // Explicit assertion on life-critical behavior
    ASSERT_GT(interval, 0);
    ASSERT_EQ(interval, calculate_demand_interval(&patient));
}

TEST(PacemakerController, BelowMinHeartRateFixedMode) {
    PatientProfile patient = {
        .min_heart_rate = 60,
        .pacemaker_mode = MODE_FIXED,
        .fixed_interval = 1000
    };

    int interval = calculate_pacing_interval(50, &patient);

    ASSERT_EQ(interval, 1000);
}

TEST(PacemakerController, AboveMaxHeartRate) {
    PatientProfile patient = {
        .max_heart_rate = 120,
        .safety_interval = 500
    };

    mock_alert_system();
    int interval = calculate_pacing_interval(150, &patient);

    // Verify alert triggered AND correct interval returned
    ASSERT_ALERT_TRIGGERED(ALERT_TACHYCARDIA);
    ASSERT_EQ(interval, 500);
}

TEST(PacemakerController, NormalHeartRate) {
    PatientProfile patient = {
        .min_heart_rate = 60,
        .max_heart_rate = 120
    };

    int interval = calculate_pacing_interval(75, &patient);

    ASSERT_EQ(interval, NO_PACING_REQUIRED);
}

// Edge case: Exactly at threshold
TEST(PacemakerController, ExactlyAtMinHeartRate) {
    PatientProfile patient = {
        .min_heart_rate = 60
    };

    int interval = calculate_pacing_interval(60, &patient);

    // Verify boundary behavior (60 is NOT below 60)
    ASSERT_EQ(interval, NO_PACING_REQUIRED);
}
```

**Coverage achieved:**
- Line coverage: 100%
- Branch coverage: 100%
- MC/DC coverage: 100% (required for FDA approval)
- Mutation score: 95%+

**Why this level of coverage:**
- Bugs can cause patient death
- Regulatory requirement (FDA 21 CFR Part 820)
- Legal liability
- **Every decision path must be validated**

---

### Example 2: Financial System (80-90% Coverage)

**Context:** Payment processing service - SaaS billing

```python
# Payment processor - HIGH coverage required (financial risk)
class PaymentProcessor:
    def process_refund(self, transaction: Transaction, reason: str) -> RefundResult:
        """Process refund with business rules validation."""

        # Critical business logic - MUST be thoroughly tested
        if transaction.amount <= 0:
            raise InvalidTransactionError("Amount must be positive")

        if transaction.status != TransactionStatus.COMPLETED:
            raise RefundNotAllowedError("Can only refund completed transactions")

        # High-value transactions need approval
        if transaction.amount > 10000:
            if not self._has_approval(transaction):
                return RefundResult(
                    status=RefundStatus.PENDING_APPROVAL,
                    approval_required=True
                )

        # Fraud detection integration
        if reason == "fraud":
            self._flag_for_review(transaction)
            self._notify_security_team(transaction)

        # Execute refund
        refund_amount = self._calculate_refund_amount(transaction)

        # Process through payment gateway
        gateway_result = self.gateway.process_refund(
            transaction.gateway_id,
            refund_amount
        )

        if gateway_result.success:
            self._update_transaction_status(transaction, TransactionStatus.REFUNDED)
            return RefundResult(
                status=RefundStatus.COMPLETED,
                amount=refund_amount,
                gateway_ref=gateway_result.reference
            )
        else:
            raise RefundFailedError(f"Gateway error: {gateway_result.error}")


# Test suite - Target 85% line, 75% branch, 80% mutation score
class TestPaymentProcessor:

    def test_process_refund_successful(self):
        """Happy path - standard refund succeeds."""
        transaction = Transaction(
            id=123,
            amount=50.00,
            status=TransactionStatus.COMPLETED,
            gateway_id="gw_abc123"
        )

        mock_gateway = Mock()
        mock_gateway.process_refund.return_value = GatewayResult(
            success=True,
            reference="ref_xyz789"
        )

        processor = PaymentProcessor(gateway=mock_gateway)
        result = processor.process_refund(transaction, reason="customer_request")

        # Comprehensive assertions
        assert result.status == RefundStatus.COMPLETED
        assert result.amount == 50.00
        assert result.gateway_ref == "ref_xyz789"

        # Verify gateway called correctly
        mock_gateway.process_refund.assert_called_once_with("gw_abc123", 50.00)

        # Verify transaction updated
        assert transaction.status == TransactionStatus.REFUNDED

    def test_process_refund_rejects_negative_amount(self):
        """Error path - negative amount rejected."""
        transaction = Transaction(amount=-50.00)

        processor = PaymentProcessor()

        with pytest.raises(InvalidTransactionError) as exc_info:
            processor.process_refund(transaction, "customer_request")

        assert "must be positive" in str(exc_info.value)

    def test_process_refund_rejects_non_completed_transaction(self):
        """Error path - pending transactions cannot be refunded."""
        transaction = Transaction(
            amount=50.00,
            status=TransactionStatus.PENDING
        )

        processor = PaymentProcessor()

        with pytest.raises(RefundNotAllowedError) as exc_info:
            processor.process_refund(transaction, "customer_request")

        assert "completed transactions" in str(exc_info.value)

    def test_process_refund_high_value_requires_approval(self):
        """Business rule - high-value refunds need approval."""
        transaction = Transaction(
            amount=15000.00,
            status=TransactionStatus.COMPLETED
        )

        processor = PaymentProcessor()
        result = processor.process_refund(transaction, "customer_request")

        # Verify approval workflow triggered
        assert result.status == RefundStatus.PENDING_APPROVAL
        assert result.approval_required is True

    def test_process_refund_high_value_with_approval_proceeds(self):
        """Edge case - approved high-value refund succeeds."""
        transaction = Transaction(
            amount=15000.00,
            status=TransactionStatus.COMPLETED,
            approval_token="approved_by_vp"
        )

        mock_gateway = Mock()
        mock_gateway.process_refund.return_value = GatewayResult(success=True)

        processor = PaymentProcessor(gateway=mock_gateway)
        result = processor.process_refund(transaction, "customer_request")

        assert result.status == RefundStatus.COMPLETED
        assert result.amount == 15000.00

    def test_process_refund_fraud_reason_triggers_security(self):
        """Critical path - fraud refunds flagged for review."""
        transaction = Transaction(
            id=123,
            amount=500.00,
            status=TransactionStatus.COMPLETED
        )

        mock_gateway = Mock()
        mock_gateway.process_refund.return_value = GatewayResult(success=True)

        processor = PaymentProcessor(gateway=mock_gateway)

        with patch.object(processor, '_flag_for_review') as mock_flag, \
             patch.object(processor, '_notify_security_team') as mock_notify:

            result = processor.process_refund(transaction, reason="fraud")

            # Verify security workflows triggered
            mock_flag.assert_called_once_with(transaction)
            mock_notify.assert_called_once_with(transaction)

            # Refund still processes
            assert result.status == RefundStatus.COMPLETED

    def test_process_refund_gateway_failure_raises_error(self):
        """Error path - gateway failure handled."""
        transaction = Transaction(
            amount=100.00,
            status=TransactionStatus.COMPLETED,
            gateway_id="gw_abc"
        )

        mock_gateway = Mock()
        mock_gateway.process_refund.return_value = GatewayResult(
            success=False,
            error="Insufficient funds in merchant account"
        )

        processor = PaymentProcessor(gateway=mock_gateway)

        with pytest.raises(RefundFailedError) as exc_info:
            processor.process_refund(transaction, "customer_request")

        assert "Gateway error" in str(exc_info.value)
        assert "Insufficient funds" in str(exc_info.value)

        # Verify transaction status NOT changed
        assert transaction.status == TransactionStatus.COMPLETED

    def test_process_refund_threshold_boundary(self):
        """Edge case - exactly $10,000 does NOT require approval."""
        transaction = Transaction(
            amount=10000.00,
            status=TransactionStatus.COMPLETED
        )

        mock_gateway = Mock()
        mock_gateway.process_refund.return_value = GatewayResult(success=True)

        processor = PaymentProcessor(gateway=mock_gateway)
        result = processor.process_refund(transaction, "customer_request")

        # $10,000 exactly is NOT > $10,000, so no approval needed
        assert result.status == RefundStatus.COMPLETED
        assert result.approval_required is False
```

**Coverage achieved:**
- Line coverage: 87% (target: 80-90%)
- Branch coverage: 78% (target: 70-80%)
- Mutation score: 82% (target: 80%)

**Why this level of coverage:**
- Financial loss risk
- PCI-DSS compliance expected
- Business reputation damage
- Not life-critical, so 100% not required
- **Focus on business logic, edge cases, error paths**

**What's excluded from coverage:**
- Logging statements
- Simple getters/setters
- Framework integration boilerplate

---

### Example 3: SaaS Web Application (60-70% Coverage)

**Context:** Task management SaaS - medium risk, balance speed/quality

```typescript
// Task service - MODERATE coverage (balance iteration speed with quality)
class TaskService {
  constructor(
    private taskRepo: TaskRepository,
    private notificationService: NotificationService
  ) {}

  async createTask(data: CreateTaskInput, userId: string): Promise<Task> {
    // Validate input - IMPORTANT to test
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    if (data.dueDate && data.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }

    // Create task - CORE LOGIC, test thoroughly
    const task = await this.taskRepo.create({
      title: data.title.trim(),
      description: data.description || '',
      dueDate: data.dueDate,
      priority: data.priority || TaskPriority.MEDIUM,
      assignedTo: data.assignedTo,
      createdBy: userId,
      status: TaskStatus.TODO,
      createdAt: new Date(),
    });

    // Send notification - TEST happy path, can skip some error cases
    if (data.assignedTo && data.assignedTo !== userId) {
      try {
        await this.notificationService.sendTaskAssigned(task);
      } catch (error) {
        // Log but don't fail task creation
        console.error('Failed to send notification:', error);
        // SKIP TESTING: Notification failures are non-critical
      }
    }

    return task;
  }

  async updateTask(taskId: string, updates: UpdateTaskInput, userId: string): Promise<Task> {
    const task = await this.taskRepo.findById(taskId);

    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }

    // Authorization check - CRITICAL, must test
    if (task.createdBy !== userId && task.assignedTo !== userId) {
      throw new UnauthorizedError('You do not have permission to update this task');
    }

    // Update logic - TEST main paths
    const updatedTask = await this.taskRepo.update(taskId, updates);

    return updatedTask;
  }

  // Simple helper - SKIP TESTING (covered incidentally)
  private formatTaskTitle(title: string): string {
    return title.trim().slice(0, 200);
  }

  // Analytics helper - LOW PRIORITY to test (internal only)
  async getTaskStats(userId: string): Promise<TaskStats> {
    const tasks = await this.taskRepo.findByUser(userId);

    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === TaskStatus.DONE).length,
      overdue: tasks.filter(t => t.dueDate && t.dueDate < new Date()).length,
    };
  }
}

// Test suite - Target 65% line, 55% branch
describe('TaskService', () => {

  // ✅ TEST: Core happy path
  it('creates task with valid data', async () => {
    const mockRepo = {
      create: jest.fn().mockResolvedValue({
        id: '123',
        title: 'Test Task',
        status: TaskStatus.TODO,
      }),
    };

    const service = new TaskService(mockRepo, mockNotificationService);

    const result = await service.createTask(
      { title: 'Test Task', priority: TaskPriority.HIGH },
      'user_1'
    );

    expect(result.id).toBe('123');
    expect(result.title).toBe('Test Task');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Task',
        priority: TaskPriority.HIGH,
        createdBy: 'user_1',
      })
    );
  });

  // ✅ TEST: Critical validation
  it('rejects task with empty title', async () => {
    const service = new TaskService(mockRepo, mockNotificationService);

    await expect(
      service.createTask({ title: '   ' }, 'user_1')
    ).rejects.toThrow(ValidationError);
  });

  // ✅ TEST: Critical validation (edge case)
  it('rejects task with past due date', async () => {
    const service = new TaskService(mockRepo, mockNotificationService);
    const yesterday = new Date(Date.now() - 86400000);

    await expect(
      service.createTask({ title: 'Task', dueDate: yesterday }, 'user_1')
    ).rejects.toThrow('Due date cannot be in the past');
  });

  // ✅ TEST: Notification sent when assigning to another user
  it('sends notification when task assigned to other user', async () => {
    const mockNotification = {
      sendTaskAssigned: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TaskService(mockRepo, mockNotification);

    await service.createTask(
      { title: 'Task', assignedTo: 'user_2' },
      'user_1'
    );

    expect(mockNotification.sendTaskAssigned).toHaveBeenCalled();
  });

  // ✅ TEST: Authorization check
  it('prevents unauthorized user from updating task', async () => {
    const mockRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '123',
        createdBy: 'user_1',
        assignedTo: 'user_2',
      }),
    };

    const service = new TaskService(mockRepo, mockNotificationService);

    await expect(
      service.updateTask('123', { title: 'Hacked' }, 'user_3')
    ).rejects.toThrow(UnauthorizedError);
  });

  // ✅ TEST: Not found error
  it('throws error when updating non-existent task', async () => {
    const mockRepo = {
      findById: jest.fn().mockResolvedValue(null),
    };

    const service = new TaskService(mockRepo, mockNotificationService);

    await expect(
      service.updateTask('999', { title: 'Update' }, 'user_1')
    ).rejects.toThrow(NotFoundError);
  });

  // ❌ SKIP: Notification error handling (non-critical)
  // ❌ SKIP: formatTaskTitle (trivial helper)
  // ❌ SKIP: getTaskStats edge cases (internal analytics, low risk)
});
```

**Coverage achieved:**
- Line coverage: 68% (target: 60-70%)
- Branch coverage: 57% (target: 50-60%)
- Mutation testing: SKIPPED (not required for this project type)

**Why this level of coverage:**
- Not financial or safety-critical
- Fast iteration more important than exhaustive testing
- Focus on core user-facing logic
- **Skip testing: Trivial helpers, logging, analytics, notification errors**

**What's tested:**
- Core business logic (task creation, updates)
- Validation rules
- Authorization checks
- Error paths (not found, unauthorized)
- Happy paths

**What's intentionally NOT tested:**
- Logging/analytics
- Non-critical error handling (notification failures)
- Simple helpers (formatTaskTitle)
- Framework integration code

---

### Example 4: Open-Source Library (85-95% Coverage)

**Context:** npm package - public API must be reliable

```javascript
// String utility library - PUBLIC API requires HIGH coverage
/**
 * Truncate string to maximum length with ellipsis.
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length (including ellipsis)
 * @param {string} suffix - Suffix to append (default: '...')
 * @returns {string} Truncated string
 */
function truncate(str, maxLength, suffix = '...') {
  // Public API - MUST validate all inputs thoroughly
  if (typeof str !== 'string') {
    throw new TypeError('First argument must be a string');
  }

  if (typeof maxLength !== 'number' || maxLength < 0) {
    throw new TypeError('maxLength must be a non-negative number');
  }

  if (typeof suffix !== 'string') {
    throw new TypeError('suffix must be a string');
  }

  // Edge case handling - MUST test all branches
  if (str.length <= maxLength) {
    return str;
  }

  if (maxLength < suffix.length) {
    // Can't fit suffix, just truncate
    return str.slice(0, maxLength);
  }

  // Standard truncation
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Parse semantic version string.
 * @param {string} version - Version string (e.g., '1.2.3-beta+build')
 * @returns {Object} Parsed version object
 */
function parseVersion(version) {
  if (typeof version !== 'string') {
    throw new TypeError('Version must be a string');
  }

  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
  const match = version.match(regex);

  if (!match) {
    throw new Error(`Invalid version string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    build: match[5] || null,
  };
}

module.exports = { truncate, parseVersion };

// Test suite - Target 90% line, 85% branch, 85% mutation score
describe('String Utils Library', () => {

  describe('truncate', () => {
    // ✅ TEST: Happy path
    it('truncates long string with default suffix', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    // ✅ TEST: Custom suffix
    it('truncates with custom suffix', () => {
      expect(truncate('Hello World', 8, '…')).toBe('Hello W…');
    });

    // ✅ TEST: Edge case - string fits exactly
    it('returns original string if length equals maxLength', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    // ✅ TEST: Edge case - string shorter than max
    it('returns original string if shorter than maxLength', () => {
      expect(truncate('Hi', 10)).toBe('Hi');
    });

    // ✅ TEST: Edge case - maxLength too small for suffix
    it('truncates without suffix when maxLength < suffix length', () => {
      expect(truncate('Hello World', 2)).toBe('He');
    });

    // ✅ TEST: Edge case - empty string
    it('handles empty string', () => {
      expect(truncate('', 5)).toBe('');
    });

    // ✅ TEST: Edge case - zero maxLength
    it('returns empty string when maxLength is 0', () => {
      expect(truncate('Hello', 0)).toBe('');
    });

    // ✅ TEST: Edge case - empty suffix
    it('supports empty suffix', () => {
      expect(truncate('Hello World', 5, '')).toBe('Hello');
    });

    // ✅ TEST: Type validation - invalid string
    it('throws TypeError for non-string input', () => {
      expect(() => truncate(123, 5)).toThrow(TypeError);
      expect(() => truncate(null, 5)).toThrow(TypeError);
      expect(() => truncate(undefined, 5)).toThrow(TypeError);
    });

    // ✅ TEST: Type validation - invalid maxLength
    it('throws TypeError for invalid maxLength', () => {
      expect(() => truncate('Hello', '5')).toThrow(TypeError);
      expect(() => truncate('Hello', -1)).toThrow(TypeError);
      expect(() => truncate('Hello', NaN)).toThrow(TypeError);
    });

    // ✅ TEST: Type validation - invalid suffix
    it('throws TypeError for non-string suffix', () => {
      expect(() => truncate('Hello', 5, 123)).toThrow(TypeError);
      expect(() => truncate('Hello', 5, null)).toThrow(TypeError);
    });

    // ✅ TEST: Unicode handling
    it('handles Unicode characters correctly', () => {
      expect(truncate('Hello 👋 World', 10)).toBe('Hello 👋...');
    });
  });

  describe('parseVersion', () => {
    // ✅ TEST: Standard version
    it('parses standard semantic version', () => {
      const result = parseVersion('1.2.3');
      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: null,
        build: null,
      });
    });

    // ✅ TEST: Version with prerelease
    it('parses version with prerelease tag', () => {
      const result = parseVersion('2.0.0-beta.1');
      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
        build: null,
      });
    });

    // ✅ TEST: Version with build metadata
    it('parses version with build metadata', () => {
      const result = parseVersion('1.0.0+20230501');
      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: null,
        build: '20230501',
      });
    });

    // ✅ TEST: Full version string
    it('parses full version with prerelease and build', () => {
      const result = parseVersion('3.1.4-rc.2+build.1234');
      expect(result).toEqual({
        major: 3,
        minor: 1,
        patch: 4,
        prerelease: 'rc.2',
        build: 'build.1234',
      });
    });

    // ✅ TEST: Error - invalid format
    it('throws error for invalid version format', () => {
      expect(() => parseVersion('1.2')).toThrow('Invalid version string');
      expect(() => parseVersion('v1.2.3')).toThrow('Invalid version string');
      expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version string');
    });

    // ✅ TEST: Error - non-numeric parts
    it('throws error for non-numeric version parts', () => {
      expect(() => parseVersion('a.b.c')).toThrow('Invalid version string');
      expect(() => parseVersion('1.x.3')).toThrow('Invalid version string');
    });

    // ✅ TEST: Type validation
    it('throws TypeError for non-string input', () => {
      expect(() => parseVersion(123)).toThrow(TypeError);
      expect(() => parseVersion(null)).toThrow(TypeError);
      expect(() => parseVersion(undefined)).toThrow(TypeError);
    });

    // ✅ TEST: Edge case - zero version
    it('parses zero version correctly', () => {
      const result = parseVersion('0.0.0');
      expect(result).toEqual({
        major: 0,
        minor: 0,
        patch: 0,
        prerelease: null,
        build: null,
      });
    });

    // ✅ TEST: Large version numbers
    it('handles large version numbers', () => {
      const result = parseVersion('999.888.777');
      expect(result.major).toBe(999);
      expect(result.minor).toBe(888);
      expect(result.patch).toBe(777);
    });
  });
});
```

**Coverage achieved:**
- Line coverage: 92% (target: 85-95%)
- Branch coverage: 88% (target: 75-85%)
- Mutation score: 87% (target: 85%)

**Why this level of coverage:**
- Public API used by many projects
- Breaking changes are costly
- Users expect high quality
- Open-source reputation critical
- **Every edge case must be validated**

**Testing philosophy:**
- Test ALL input validation
- Test ALL edge cases (empty, zero, boundary values)
- Test ALL error paths
- Test Unicode/special character handling
- **Documentation-driven testing** (tests verify documented behavior)

---

## The 100% Coverage Trap

### What Is It?

The "100% Coverage Trap" is the mistaken belief that 100% code coverage equals comprehensive testing. In reality:

- **100% coverage can have ZERO assertions** (tests execute code but validate nothing)
- **100% coverage can miss critical edge cases** (only tests happy paths)
- **100% coverage can test trivial code** (getters/setters) while missing complex logic
- **100% coverage can be expensive to maintain** (tests break on refactoring)

### Why 100% Coverage Is Often Wasteful

```java
// Example: Chasing 100% coverage on trivial code
public class User {
    private String name;
    private String email;

    // Trivial getter - NO VALUE in testing
    public String getName() {
        return name;
    }

    // Trivial setter - NO VALUE in testing
    public void setName(String name) {
        this.name = name;
    }

    // Simple toString - LOW VALUE in testing
    @Override
    public String toString() {
        return "User{name='" + name + "', email='" + email + "'}";
    }

    // Framework code - SKIP TESTING
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(name, user.name) &&
               Objects.equals(email, user.email);
    }

    // Auto-generated hashCode - SKIP TESTING
    @Override
    public int hashCode() {
        return Objects.hash(name, email);
    }
}

// ❌ WRONG: Testing trivial getters/setters for coverage
@Test
public void testGetName() {
    User user = new User();
    user.setName("Alice");
    assertEquals("Alice", user.getName());
    // This test has ZERO value - just testing Java's field assignment
}

@Test
public void testToString() {
    User user = new User("Alice", "alice@example.com");
    String result = user.toString();
    assertTrue(result.contains("Alice"));
    // LOW value - only useful if toString has complex logic
}
```

**What to exclude from coverage:**

1. **Trivial getters/setters** (unless they have validation logic)
2. **Auto-generated code** (hashCode, equals, toString)
3. **Framework integration code** (Spring Boot auto-config, Django admin)
4. **Logging statements** (no business logic)
5. **Constants and type definitions** (nothing to test)
6. **Third-party library wrappers** (test integration, not library itself)

### ✅ CORRECT: Focus on Meaningful Coverage

```java
// Focus testing on COMPLEX business logic
public class DiscountCalculator {

    // COMPLEX LOGIC - TEST THOROUGHLY
    public Discount calculateDiscount(Customer customer, Order order) {
        // Input validation - MUST TEST
        if (order.getSubtotal() < 0) {
            throw new InvalidOrderException("Subtotal cannot be negative");
        }

        // Complex business rules - MUST TEST
        if (customer.getTier() == CustomerTier.GOLD) {
            if (customer.getYearsActive() >= 5) {
                return new Discount(15.0, "Gold 5+ years");
            } else if (customer.getYearsActive() >= 2) {
                return new Discount(10.0, "Gold 2-4 years");
            }
        } else if (customer.getTier() == CustomerTier.SILVER) {
            if (order.getSubtotal() > 500) {
                return new Discount(10.0, "Silver high value");
            } else if (order.getSubtotal() > 200) {
                return new Discount(5.0, "Silver medium value");
            }
        }

        // Edge cases - MUST TEST
        if (customer.isEmployee()) {
            return new Discount(20.0, "Employee discount");
        }

        return Discount.none();
    }

    // Simple getter - SKIP TESTING (or test incidentally)
    public String getVersion() {
        return "1.0.0";
    }
}

// ✅ Test suite focuses on complex logic, skips trivial code
@Test
public void testGoldCustomerFiveYearsGetsCorrectDiscount() {
    // Test complex business rule
    Customer customer = new Customer(CustomerTier.GOLD, 5);
    Order order = new Order(1000.0);

    Discount result = calculator.calculateDiscount(customer, order);

    assertEquals(15.0, result.getPercent(), 0.01);
    assertEquals("Gold 5+ years", result.getReason());
}

@Test
public void testGoldCustomerFourYearsEdgeCase() {
    // Edge case at boundary
    Customer customer = new Customer(CustomerTier.GOLD, 4);
    Order order = new Order(1000.0);

    Discount result = calculator.calculateDiscount(customer, order);

    // Should get 10% (not 15%)
    assertEquals(10.0, result.getPercent(), 0.01);
}

// NO TEST for getVersion() - trivial code, not worth testing
```

**Result:**
- Line coverage: 85% (excludes trivial getVersion)
- Branch coverage: 90% (all business logic paths tested)
- Mutation score: 88%
- **Time spent testing high-value code, not chasing 100% on trivial code**

---

## Anti-Patterns: Common Coverage Mistakes

### Anti-Pattern 1: Chasing Coverage Percentage Over Quality

❌ **WRONG:**
```python
# Gaming coverage metrics with assertion-free tests
def test_complex_business_flow():
    # Executes 50 lines of code
    result = process_order(customer, cart, payment_method)

    # WRONG: No assertions - test passes regardless of result
    assert result is not None  # Useless assertion
```

✅ **CORRECT:**
```python
def test_order_processing_calculates_correct_total():
    customer = Customer(tier='gold', years_active=5)
    cart = Cart(items=[Item(price=100), Item(price=50)])
    payment = PaymentMethod(type='credit_card')

    result = process_order(customer, cart, payment)

    # Comprehensive assertions
    assert result.subtotal == 150.00
    assert result.discount_percent == 15.0
    assert result.discount_amount == 22.50
    assert result.total == 127.50
    assert result.status == OrderStatus.COMPLETED
```

---

### Anti-Pattern 2: One-Size-Fits-All Coverage Target

❌ **WRONG:**
```json
// jest.config.js - Same 80% target for ALL code
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "lines": 80,
      "statements": 80,
      "functions": 80
    }
  }
}
```

✅ **CORRECT:**
```javascript
// jest.config.js - Module-specific targets
module.exports = {
  coverageThreshold: {
    global: {
      branches: 60,
      lines: 70
    },
    './src/payments/': {
      branches: 85,
      lines: 90
    },
    './src/auth/': {
      branches: 80,
      lines: 85
    },
    './src/admin/': {
      branches: 40,
      lines: 50
    }
  }
};
```

---

### Anti-Pattern 3: Excluding Critical Code from Coverage

❌ **WRONG:**
```python
# Excluding complex logic to maintain coverage %
def calculate_tax(subtotal, customer):
    if customer.region == 'EU':  # pragma: no cover
        # WRONG: Complex VAT calculation excluded
        return calculate_eu_vat(subtotal, customer.country)
    else:  # pragma: no cover
        # WRONG: State tax logic excluded
        return calculate_us_tax(subtotal, customer.state)
```

✅ **CORRECT:**
```python
def calculate_tax(subtotal, customer):
    if customer.region == 'EU':
        return calculate_eu_vat(subtotal, customer.country)
    else:
        return calculate_us_tax(subtotal, customer.state)

# Test both branches thoroughly
def test_eu_vat_calculation():
    customer = Customer(region='EU', country='DE')
    tax = calculate_tax(100.00, customer)
    assert tax == 19.00  # Germany VAT rate

def test_us_state_tax_calculation():
    customer = Customer(region='US', state='CA')
    tax = calculate_tax(100.00, customer)
    assert tax == 7.25  # California state tax
```

---

### Anti-Pattern 4: Testing Implementation Instead of Behavior

❌ **WRONG:**
```typescript
// Testing internal implementation details
test('UserService calls repository correctly', () => {
  const mockRepo = jest.fn();
  const service = new UserService(mockRepo);

  service.getUser(123);

  // WRONG: Only tests that method was called
  expect(mockRepo).toHaveBeenCalledWith(123);
  // Doesn't verify: correct user returned, errors handled, etc.
});
```

✅ **CORRECT:**
```typescript
// Testing external behavior
test('UserService returns correct user data', () => {
  const mockRepo = {
    findById: jest.fn().mockResolvedValue({
      id: 123,
      name: 'Alice',
      email: 'alice@example.com'
    })
  };
  const service = new UserService(mockRepo);

  const user = await service.getUser(123);

  // Test behavior: correct data returned
  expect(user.id).toBe(123);
  expect(user.name).toBe('Alice');
  expect(user.email).toBe('alice@example.com');
});

test('UserService throws error for non-existent user', () => {
  const mockRepo = {
    findById: jest.fn().mockResolvedValue(null)
  };
  const service = new UserService(mockRepo);

  // Test error behavior
  await expect(service.getUser(999)).rejects.toThrow(UserNotFoundError);
});
```

---

## Quality Metrics Beyond Coverage

Coverage alone is insufficient. Track these additional metrics:

### 1. Mutation Score

**What it measures:** Whether tests actually catch bugs

**How it works:** Introduces bugs (mutations) and checks if tests fail

**Target by context:**
- Critical business logic: 80-90%
- Standard CRUD: 60-70%
- Utility functions: 90%+

**Tools:**
- JavaScript: Stryker
- Java: PITest
- Python: mutmut
- C#: Stryker.NET

### 2. Test-to-Code Ratio

**What it measures:** Lines of test code vs production code

**Typical ratios:**
- Well-tested projects: 1.5:1 to 3:1 (more test code than production)
- Under-tested projects: < 0.5:1

**Interpretation:** Higher ratio doesn't always mean better quality, but very low ratios (< 0.3:1) suggest insufficient testing.

### 3. Flaky Test Rate

**What it measures:** Percentage of tests that fail intermittently

**Target:** < 1% flaky tests

**Action threshold:** > 5% flaky rate indicates serious test quality problems

### 4. Test Execution Time

**What it measures:** How long test suite takes to run

**Targets:**
- Unit tests: < 10 seconds
- Integration tests: < 2 minutes
- E2E tests: < 10 minutes

**Why it matters:** Slow tests reduce developer productivity and discourage running tests frequently.

### 5. Code Churn vs Test Churn

**What it measures:** Ratio of production code changes to test code changes

**Healthy pattern:** Test changes roughly match production changes (ratio near 1:1)

**Red flag:** High production churn with low test churn suggests tests aren't being maintained.

---

## Framework-Specific Coverage Configuration

### Jest (JavaScript/TypeScript)

```javascript
// jest.config.js
module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      lines: 80,
      statements: 80,
      functions: 80
    },
    './src/payments/': {
      branches: 85,
      lines: 90
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
```

### Pytest (Python)

```ini
# .coveragerc
[run]
branch = True
source = src/
omit =
    tests/*
    */migrations/*
    */admin.py
    */settings.py

[report]
precision = 2
show_missing = True
skip_covered = False

exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if TYPE_CHECKING:
    if __name__ == .__main__.:

[coverage:report]
fail_under = 70
```

### JUnit + JaCoCo (Java)

```xml
<!-- pom.xml -->
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.10</version>
  <configuration>
    <rules>
      <rule>
        <element>BUNDLE</element>
        <limits>
          <limit>
            <counter>BRANCH</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.70</minimum>
          </limit>
          <limit>
            <counter>LINE</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.80</minimum>
          </limit>
        </limits>
      </rule>
      <rule>
        <element>PACKAGE</element>
        <limits>
          <limit>
            <counter>LINE</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.90</minimum>
          </limit>
        </limits>
        <includes>
          <include>com.example.payments.*</include>
          <include>com.example.auth.*</include>
        </includes>
      </rule>
    </rules>
    <excludes>
      <exclude>**/*Test.class</exclude>
      <exclude>**/config/*.class</exclude>
      <exclude>**/entity/*.class</exclude>
    </excludes>
  </configuration>
</plugin>
```

### RSpec + SimpleCov (Ruby)

```ruby
# spec/spec_helper.rb
require 'simplecov'

SimpleCov.start do
  add_filter '/spec/'
  add_filter '/config/'
  add_filter '/db/migrate/'

  add_group 'Models', 'app/models'
  add_group 'Controllers', 'app/controllers'
  add_group 'Services', 'app/services'
  add_group 'Lib', 'lib'

  minimum_coverage branch: 70, line: 80
  refuse_coverage_drop :branch, :line

  # Track trends over time
  track_files '{app,lib}/**/*.rb'
end
```

---

## Summary: Effective Coverage Strategy

**Key Principles:**

1. **Context determines targets**: Medical devices need 95-100%, SaaS apps need 60-80%

2. **Module-specific targets**: Payment processing needs 85-90%, admin tools need 40-60%

3. **Branch coverage > Line coverage**: Branch coverage catches more bugs

4. **Mutation testing validates quality**: High coverage + low mutation score = weak tests

5. **Avoid the 100% coverage trap**: Don't test trivial code, focus on business logic

6. **Don't game metrics**: Assertion-free tests and excessive exclusions create false confidence

7. **Track multiple metrics**: Coverage + mutation score + flaky rate + test-to-code ratio

**Decision Framework:**

1. Identify project risk level (safety-critical → prototype)
2. Set appropriate global baseline (40% → 95%)
3. Identify critical modules (auth, payments, security)
4. Set higher targets for critical modules (85-95%)
5. Configure branch coverage tracking
6. Add mutation testing for high-risk code
7. Exclude trivial code from coverage (getters, framework code)
8. Monitor trends, not just absolute percentages

**Sources:**
- [TestCoverage - Martin Fowler](https://martinfowler.com/bliki/TestCoverage.html)
- [Code Coverage Best Practices - Google Testing Blog](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- [Software Engineering at Google - Chapter 11: Testing](https://abseil.io/resources/swe-book/html/ch11.html)
- [How Google Tests Software - James Whittaker et al.](https://www.amazon.com/Google-Tests-Software-James-Whittaker/dp/0321803027)
- [The Practical Test Pyramid - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Mutation Testing: A Practical Guide - PIT Documentation](https://pitest.org/)
