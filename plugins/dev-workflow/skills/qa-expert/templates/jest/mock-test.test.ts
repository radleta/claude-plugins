# Template: Mock Test

**When to Use**: Testing code with external dependencies like APIs, databases, file systems, third-party libraries, environment variables, or any code that interacts with systems outside your control.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Over-mocking (mocking everything including internal functions you own)
- Not resetting mocks between tests (causing test pollution)
- Mocking implementation details instead of interfaces
- Not verifying mock calls with proper matchers
- Using jest.fn() when jest.spyOn() is more appropriate
- Forgetting to restore original implementations after tests
- Not mocking at the right level (too high or too low in the stack)
- Creating mock data that doesn't match real API responses
- Not testing both mocked and unmocked scenarios
- Mocking what you don't own (prefer integration tests for third-party code)

## Template

```typescript
import { {{functionUnderTest}} } from './{{modulePath}}';
import { {{ExternalService}} } from './{{externalServicePath}}';
import { {{ApiClient}} } from './{{apiPath}}';
import * as {{moduleToMock}} from './{{moduleToMockPath}}';

// Mock external modules
jest.mock('./{{externalServicePath}}');
jest.mock('./{{apiPath}}');

/**
 * Test suite for {{FeatureName}} with mocked dependencies
 *
 * Tests behavior by mocking external services and verifying
 * interactions without hitting real dependencies.
 */
describe('{{FeatureName}} - Mocked Dependencies', () => {
  /**
   * Cleanup: Reset mocks after each test
   */
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  /**
   * Basic mock function tests
   */
  describe('jest.fn() - mock functions', () => {
    it('should call callback with correct arguments', () => {
      // Arrange
      const mockCallback = jest.fn();
      const items = [{{item1}}, {{item2}}, {{item3}}];

      // Act
      {{functionUnderTest}}(items, mockCallback);

      // Assert
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenCalledWith({{item1}}, 0, items);
      expect(mockCallback).toHaveBeenCalledWith({{item2}}, 1, items);
      expect(mockCallback).toHaveBeenCalledWith({{item3}}, 2, items);
    });

    it('should track all calls to mock function', () => {
      // Arrange
      const mockFn = jest.fn();

      // Act
      mockFn('first');
      mockFn('second');
      mockFn('third');

      // Assert
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(mockFn.mock.calls[0][0]).toBe('first');
      expect(mockFn.mock.calls[1][0]).toBe('second');
      expect(mockFn.mock.calls[2][0]).toBe('third');
    });

    it('should return mocked values', () => {
      // Arrange
      const mockFn = jest.fn()
        .mockReturnValue({{defaultValue}});

      // Act
      const result = mockFn({{anyInput}});

      // Assert
      expect(result).toBe({{defaultValue}});
    });

    it('should return different values for different calls', () => {
      // Arrange
      const mockFn = jest.fn()
        .mockReturnValueOnce({{value1}})
        .mockReturnValueOnce({{value2}})
        .mockReturnValue({{defaultValue}});

      // Act & Assert
      expect(mockFn()).toBe({{value1}});
      expect(mockFn()).toBe({{value2}});
      expect(mockFn()).toBe({{defaultValue}});
      expect(mockFn()).toBe({{defaultValue}}); // Subsequent calls
    });

    it('should resolve with mocked async value', async () => {
      // Arrange
      const mockAsyncFn = jest.fn()
        .mockResolvedValue({{asyncValue}});

      // Act
      const result = await mockAsyncFn({{input}});

      // Assert
      expect(result).toBe({{asyncValue}});
      expect(mockAsyncFn).toHaveBeenCalledWith({{input}});
    });

    it('should reject with mocked error', async () => {
      // Arrange
      const mockAsyncFn = jest.fn()
        .mockRejectedValue(new Error('{{errorMessage}}'));

      // Act & Assert
      await expect(mockAsyncFn()).rejects.toThrow('{{errorMessage}}');
    });

    it('should implement custom mock behavior', () => {
      // Arrange
      const mockFn = jest.fn().mockImplementation((x, y) => x + y);

      // Act
      const result = mockFn(2, 3);

      // Assert
      expect(result).toBe(5);
      expect(mockFn).toHaveBeenCalledWith(2, 3);
    });
  });

  /**
   * jest.spyOn() tests - spy on existing methods
   */
  describe('jest.spyOn() - method spies', () => {
    it('should spy on object method', () => {
      // Arrange
      const spy = jest.spyOn({{object}}, '{{methodName}}');

      // Act
      {{object}}.{{methodName}}({{arg}});

      // Assert
      expect(spy).toHaveBeenCalledWith({{arg}});
      expect(spy).toHaveBeenCalledTimes(1);

      // Cleanup
      spy.mockRestore();
    });

    it('should spy and mock return value', () => {
      // Arrange
      const spy = jest.spyOn({{object}}, '{{methodName}}')
        .mockReturnValue({{mockedValue}});

      // Act
      const result = {{object}}.{{methodName}}({{arg}});

      // Assert
      expect(result).toBe({{mockedValue}});
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should spy on implementation while keeping original', () => {
      // Arrange
      const originalImplementation = {{object}}.{{methodName}};
      const spy = jest.spyOn({{object}}, '{{methodName}}');

      // Act
      const result = {{object}}.{{methodName}}({{arg}});

      // Assert - original behavior preserved
      expect(spy).toHaveBeenCalledWith({{arg}});
      expect(result).toBe({{expectedOriginalResult}});

      spy.mockRestore();
    });

    it('should spy on module function', () => {
      // Arrange
      const spy = jest.spyOn({{moduleToMock}}, '{{functionName}}')
        .mockResolvedValue({{mockedValue}});

      // Act
      const result = await {{functionUnderTest}}({{input}});

      // Assert
      expect(spy).toHaveBeenCalled();
      expect(result).toBe({{expectedResult}});

      spy.mockRestore();
    });
  });

  /**
   * jest.mock() tests - module mocking
   */
  describe('jest.mock() - module mocking', () => {
    it('should mock entire module', async () => {
      // Arrange
      const mockData = { {{property}}: {{value}} };
      ({{ApiClient}}.{{methodName}} as jest.Mock).mockResolvedValue(mockData);

      // Act
      const result = await {{functionUnderTest}}({{input}});

      // Assert
      expect({{ApiClient}}.{{methodName}}).toHaveBeenCalledWith({{expectedArg}});
      expect(result).toEqual(mockData);
    });

    it('should mock class constructor', () => {
      // Arrange
      const mockInstance = {
        {{method1}}: jest.fn().mockReturnValue({{value1}}),
        {{method2}}: jest.fn().mockReturnValue({{value2}}),
      };

      ({{ExternalService}} as jest.MockedClass<typeof {{ExternalService}}>)
        .mockImplementation(() => mockInstance as any);

      // Act
      const instance = new {{ExternalService}}();
      const result = instance.{{method1}}();

      // Assert
      expect(result).toBe({{value1}});
      expect(mockInstance.{{method1}}).toHaveBeenCalled();
    });

    it('should partially mock module', () => {
      // Arrange
      jest.mock('./{{modulePath}}', () => ({
        ...jest.requireActual('./{{modulePath}}'),
        {{functionToMock}}: jest.fn().mockReturnValue({{mockedValue}}),
      }));

      // Act
      const result = {{functionToMock}}();

      // Assert
      expect(result).toBe({{mockedValue}});
    });
  });

  /**
   * API client mocking tests
   */
  describe('API client mocking', () => {
    it('should mock successful API response', async () => {
      // Arrange
      const mockResponse = {
        data: { {{property1}}: {{value1}}, {{property2}}: {{value2}} },
        status: 200,
        statusText: 'OK',
      };

      const mockGet = jest.fn().mockResolvedValue(mockResponse);
      const apiClient = { get: mockGet, post: jest.fn(), put: jest.fn(), delete: jest.fn() };

      // Act
      const result = await {{functionUnderTest}}(apiClient, {{input}});

      // Assert
      expect(mockGet).toHaveBeenCalledWith('/{{endpoint}}', {
        params: { {{param}}: {{value}} },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should mock API error response', async () => {
      // Arrange
      const mockError = {
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      };

      const mockGet = jest.fn().mockRejectedValue(mockError);
      const apiClient = { get: mockGet };

      // Act & Assert
      await expect({{functionUnderTest}}(apiClient, {{input}}))
        .rejects
        .toMatchObject({
          response: {
            status: 404,
            data: { error: 'Not found' },
          },
        });
    });

    it('should mock different responses for different calls', async () => {
      // Arrange
      const mockGet = jest.fn()
        .mockResolvedValueOnce({ data: {{firstResponse}} })
        .mockResolvedValueOnce({ data: {{secondResponse}} })
        .mockRejectedValueOnce(new Error('Third call fails'));

      // Act & Assert
      const result1 = await mockGet();
      expect(result1.data).toEqual({{firstResponse}});

      const result2 = await mockGet();
      expect(result2.data).toEqual({{secondResponse}});

      await expect(mockGet()).rejects.toThrow('Third call fails');
    });
  });

  /**
   * Database mocking tests
   */
  describe('database mocking', () => {
    it('should mock database query', async () => {
      // Arrange
      const mockDbResult = [
        { id: 1, {{property}}: {{value1}} },
        { id: 2, {{property}}: {{value2}} },
      ];

      const mockQuery = jest.fn().mockResolvedValue(mockDbResult);
      const db = { query: mockQuery, insert: jest.fn(), update: jest.fn() };

      // Act
      const result = await {{functionUnderTest}}(db, {{queryInput}});

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
      expect(result).toEqual(mockDbResult);
    });

    it('should mock database insert', async () => {
      // Arrange
      const mockInsertId = 123;
      const mockInsert = jest.fn().mockResolvedValue({ insertId: mockInsertId });
      const db = { insert: mockInsert };

      // Act
      const result = await {{functionUnderTest}}(db, {{dataToInsert}});

      // Assert
      expect(mockInsert).toHaveBeenCalledWith('{{tableName}}', {{dataToInsert}});
      expect(result.insertId).toBe(mockInsertId);
    });

    it('should mock database transaction', async () => {
      // Arrange
      const mockCommit = jest.fn().mockResolvedValue(undefined);
      const mockRollback = jest.fn().mockResolvedValue(undefined);
      const mockTransaction = {
        query: jest.fn().mockResolvedValue([]),
        commit: mockCommit,
        rollback: mockRollback,
      };

      const db = {
        beginTransaction: jest.fn().mockResolvedValue(mockTransaction),
      };

      // Act
      await {{functionUnderTest}}(db, {{input}});

      // Assert
      expect(db.beginTransaction).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
      expect(mockRollback).not.toHaveBeenCalled();
    });
  });

  /**
   * File system mocking tests
   */
  describe('file system mocking', () => {
    it('should mock fs.readFile', async () => {
      // Arrange
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('{{fileContent}}');

      // Act
      const result = await {{functionUnderTest}}('{{filePath}}');

      // Assert
      expect(fs.readFile).toHaveBeenCalledWith('{{filePath}}', 'utf8');
      expect(result).toBe('{{fileContent}}');
    });

    it('should mock fs.writeFile', async () => {
      // Arrange
      const fs = require('fs').promises;
      const mockWriteFile = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      // Act
      await {{functionUnderTest}}('{{filePath}}', '{{content}}');

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('{{filePath}}', '{{content}}', 'utf8');
    });

    it('should mock file system error', async () => {
      // Arrange
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT: no such file'));

      // Act & Assert
      await expect({{functionUnderTest}}('{{nonExistentFile}}'))
        .rejects
        .toThrow('ENOENT');
    });
  });

  /**
   * Environment and config mocking
   */
  describe('environment mocking', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Create a clean copy of environment
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should use mocked environment variables', () => {
      // Arrange
      process.env.{{ENV_VAR}} = '{{mockedValue}}';

      // Act
      const result = {{functionUnderTest}}();

      // Assert
      expect(result).toBe('{{mockedValue}}');
    });

    it('should handle missing environment variables', () => {
      // Arrange
      delete process.env.{{ENV_VAR}};

      // Act & Assert
      expect(() => {{functionUnderTest}}()).toThrow('Missing required env var');
    });
  });

  /**
   * Date and time mocking
   */
  describe('date and time mocking', () => {
    beforeEach(() => {
      // Mock Date
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use mocked date', () => {
      // Act
      const result = {{functionUnderTest}}();

      // Assert
      expect(result).toContain('2024-01-01');
    });

    it('should test time-dependent logic', () => {
      // Arrange
      const now = new Date('2024-01-01T12:00:00.000Z');
      jest.setSystemTime(now);

      // Act
      const result = {{functionUnderTest}}();

      // Assert
      expect(result.timestamp).toBe(now.getTime());
    });
  });

  /**
   * Third-party library mocking
   */
  describe('third-party library mocking', () => {
    it('should mock axios requests', async () => {
      // Arrange
      const axios = require('axios');
      const mockResponse = { data: { {{property}}: {{value}} } };
      jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      // Act
      const result = await {{functionUnderTest}}('{{url}}');

      // Assert
      expect(axios.get).toHaveBeenCalledWith('{{url}}');
      expect(result).toEqual(mockResponse.data);
    });

    it('should mock logger', () => {
      // Arrange
      const logger = require('./{{loggerPath}}');
      const mockLog = jest.spyOn(logger, 'info').mockImplementation();

      // Act
      {{functionUnderTest}}({{input}});

      // Assert
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('{{logMessage}}')
      );
    });
  });

  /**
   * Mock verification tests
   */
  describe('mock call verification', () => {
    it('should verify mock called with exact arguments', () => {
      // Arrange
      const mockFn = jest.fn();

      // Act
      {{functionUnderTest}}(mockFn, {{arg1}}, {{arg2}});

      // Assert
      expect(mockFn).toHaveBeenCalledWith({{arg1}}, {{arg2}});
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should verify mock called with matchers', () => {
      // Arrange
      const mockFn = jest.fn();

      // Act
      {{functionUnderTest}}(mockFn);

      // Assert
      expect(mockFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ {{property}}: {{value}} }),
        expect.arrayContaining([{{item}}])
      );
    });

    it('should verify call order', () => {
      // Arrange
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();

      // Act
      {{functionUnderTest}}(mockFn1, mockFn2);

      // Assert
      expect(mockFn1).toHaveBeenCalled();
      expect(mockFn2).toHaveBeenCalled();

      const call1Time = mockFn1.mock.invocationCallOrder[0];
      const call2Time = mockFn2.mock.invocationCallOrder[0];
      expect(call1Time).toBeLessThan(call2Time);
    });

    it('should verify mock never called', () => {
      // Arrange
      const mockFn = jest.fn();

      // Act
      {{functionUnderTest}}({{inputThatSkipsMock}});

      // Assert
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});
```

## Adaptation Rules

- [ ] Replace `{{ExternalService}}` with actual dependencies to mock
- [ ] Use `jest.fn()` for creating mock functions
- [ ] Use `jest.spyOn()` for spying on existing methods
- [ ] Use `jest.mock()` for mocking entire modules
- [ ] Always clean up mocks in `afterEach` with `jest.clearAllMocks()`
- [ ] Restore spies with `spy.mockRestore()` or `jest.restoreAllMocks()`
- [ ] Mock at the boundary (APIs, databases, file system)
- [ ] Don't mock your own code (test it directly or with integration tests)
- [ ] Verify mock calls with specific matchers
- [ ] Create realistic mock data that matches actual API responses

## Related

- Template: @templates/jest/basic-unit-test.test.ts (for testing without mocks)
- Template: @templates/jest/integration-test.test.ts (for testing with real dependencies)
- Template: @templates/jest/async-test.test.ts (for async mocking patterns)

## Example: User Service with Mocked API

```typescript
import { getUserProfile, updateUserProfile } from './userService';
import { apiClient } from './apiClient';

jest.mock('./apiClient');

describe('User Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should fetch user profile from API', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });

      const result = await getUserProfile(1);

      expect(apiClient.get).toHaveBeenCalledWith('/users/1');
      expect(result).toEqual(mockUser);
    });

    it('should throw error when API fails', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(getUserProfile(1)).rejects.toThrow('Network error');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile via API', async () => {
      const updates = { name: 'Jane Doe' };
      const updatedUser = { id: 1, ...updates };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: updatedUser });

      const result = await updateUserProfile(1, updates);

      expect(apiClient.put).toHaveBeenCalledWith('/users/1', updates);
      expect(result).toEqual(updatedUser);
    });
  });
});
```
