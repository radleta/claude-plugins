# Template: Integration Test with Spring Boot

**When to Use**: Testing database operations, REST APIs, Spring components, service layer integration, or interactions between multiple system components.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not cleaning up database state between tests (causing test interdependence)
- Not using `@Transactional` causing persistent data pollution
- Forgetting `@SpringBootTest` annotation
- Not using test-specific configuration or profiles
- Sharing mutable state across test methods
- Not properly initializing test data in database
- Mixing unit tests and integration tests in same class
- Not using `@DirtiesContext` when modifying application context
- Hardcoding URLs instead of using `@LocalServerPort`
- Not testing actual HTTP responses (status codes, headers, body)

## Maven Dependencies

```xml
<dependencies>
    <!-- Spring Boot Test Starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- Spring Boot Web (for REST API testing) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Spring Data JPA (for database testing) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- H2 Database (for in-memory testing) -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- Optional: Testcontainers for real database testing -->
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>1.19.3</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>postgresql</artifactId>
        <version>1.19.3</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

## Gradle Dependencies

```gradle
dependencies {
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    testImplementation 'com.h2database:h2'

    // Optional: Testcontainers
    testImplementation 'org.testcontainers:junit-jupiter:1.19.3'
    testImplementation 'org.testcontainers:postgresql:1.19.3'
}

test {
    useJUnitPlatform()
}
```

## Template

```java
package {{package}}.{{module}};

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import {{package}}.repository.{{RepositoryName}};
import {{package}}.model.{{EntityName}};
import {{package}}.dto.{{DtoName}};

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for {{ComponentName}}
 *
 * Tests {{description of integration scenario}}
 *
 * Uses test database and Spring application context.
 * Database is rolled back after each test via @Transactional.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test") // Use application-test.yml or application-test.properties
@Transactional // Rollback database changes after each test
@DisplayName("{{ComponentName}} Integration Tests")
class {{ComponentName}}IntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private {{RepositoryName}} {{repositoryInstance}};

    private String baseUrl;

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api/{{resourcePath}}";

        // Clean up database before each test
        {{repositoryInstance}}.deleteAll();

        // Insert test data if needed
        {{EntityName}} testEntity = new {{EntityName}}();
        testEntity.set{{Property}}({{testValue}});
        {{repositoryInstance}}.save(testEntity);
    }

    @AfterEach
    void tearDown() {
        // Additional cleanup if @Transactional is not used
        // {{repositoryInstance}}.deleteAll();
    }

    // ==================== DATABASE INTEGRATION TESTS ====================

    @Test
    @DisplayName("should save entity to database")
    void shouldSaveEntityToDatabase() {
        // Arrange
        {{EntityName}} entity = new {{EntityName}}();
        entity.set{{Property1}}({{value1}});
        entity.set{{Property2}}({{value2}});

        // Act
        {{EntityName}} saved = {{repositoryInstance}}.save(entity);

        // Assert
        assertNotNull(saved.getId(), "Saved entity should have an ID");
        assertEquals({{value1}}, saved.get{{Property1}}());
        assertEquals({{value2}}, saved.get{{Property2}}());

        // Verify entity exists in database
        Optional<{{EntityName}}> found = {{repositoryInstance}}.findById(saved.getId());
        assertTrue(found.isPresent(), "Entity should be retrievable from database");
    }

    @Test
    @DisplayName("should find entity by {{criteriaName}}")
    void shouldFindEntityBy{{CriteriaName}}() {
        // Arrange
        {{CriteriaType}} criteria = {{criteriaValue}};

        // Act
        List<{{EntityName}}> results = {{repositoryInstance}}.findBy{{CriteriaName}}(criteria);

        // Assert
        assertFalse(results.isEmpty(), "Should find at least one entity");
        assertEquals({{expectedCount}}, results.size());
        assertTrue(results.stream()
            .allMatch(e -> e.get{{CriteriaName}}().equals(criteria)),
            "All results should match criteria");
    }

    @Test
    @DisplayName("should update entity in database")
    void shouldUpdateEntityInDatabase() {
        // Arrange
        {{EntityName}} existing = {{repositoryInstance}}.findAll().get(0);
        Long id = existing.getId();
        {{PropertyType}} newValue = {{updatedValue}};

        // Act
        existing.set{{Property}}(newValue);
        {{repositoryInstance}}.save(existing);

        // Assert
        {{EntityName}} updated = {{repositoryInstance}}.findById(id).orElseThrow();
        assertEquals(newValue, updated.get{{Property}}());
    }

    @Test
    @DisplayName("should delete entity from database")
    void shouldDeleteEntityFromDatabase() {
        // Arrange
        {{EntityName}} existing = {{repositoryInstance}}.findAll().get(0);
        Long id = existing.getId();

        // Act
        {{repositoryInstance}}.deleteById(id);

        // Assert
        Optional<{{EntityName}}> deleted = {{repositoryInstance}}.findById(id);
        assertFalse(deleted.isPresent(), "Entity should no longer exist");
    }

    @Test
    @DisplayName("should enforce unique constraint on {{fieldName}}")
    void shouldEnforceUniqueConstraintOn{{FieldName}}() {
        // Arrange
        {{EntityName}} entity1 = new {{EntityName}}();
        entity1.set{{UniqueField}}({{duplicateValue}});

        {{EntityName}} entity2 = new {{EntityName}}();
        entity2.set{{UniqueField}}({{duplicateValue}}); // Same value

        // Act
        {{repositoryInstance}}.save(entity1);

        // Assert
        assertThrows(
            Exception.class, // Could be DataIntegrityViolationException
            () -> {
                {{repositoryInstance}}.save(entity2);
                {{repositoryInstance}}.flush(); // Force immediate write
            },
            "Should throw exception for duplicate unique field"
        );
    }

    // ==================== REST API INTEGRATION TESTS ====================

    @Test
    @DisplayName("should return 200 OK when getting all {{resourceName}}")
    void shouldReturn200OkWhenGettingAll{{ResourceName}}() {
        // Act
        ResponseEntity<{{DtoName}}[]> response = restTemplate.getForEntity(
            baseUrl,
            {{DtoName}}[].class
        );

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().length > 0, "Should return at least one item");
    }

    @Test
    @DisplayName("should return 200 OK when getting {{resourceName}} by ID")
    void shouldReturn200OkWhenGetting{{ResourceName}}ById() {
        // Arrange
        {{EntityName}} existing = {{repositoryInstance}}.findAll().get(0);
        Long id = existing.getId();
        String url = baseUrl + "/" + id;

        // Act
        ResponseEntity<{{DtoName}}> response = restTemplate.getForEntity(
            url,
            {{DtoName}}.class
        );

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(id, response.getBody().getId());
    }

    @Test
    @DisplayName("should return 404 NOT FOUND when {{resourceName}} does not exist")
    void shouldReturn404NotFoundWhen{{ResourceName}}DoesNotExist() {
        // Arrange
        Long nonExistentId = 99999L;
        String url = baseUrl + "/" + nonExistentId;

        // Act
        ResponseEntity<String> response = restTemplate.getForEntity(
            url,
            String.class
        );

        // Assert
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("should create new {{resourceName}} via POST")
    void shouldCreateNew{{ResourceName}}ViaPost() {
        // Arrange
        {{DtoName}} newDto = new {{DtoName}}();
        newDto.set{{Property1}}({{value1}});
        newDto.set{{Property2}}({{value2}});

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<{{DtoName}}> request = new HttpEntity<>(newDto, headers);

        // Act
        ResponseEntity<{{DtoName}}> response = restTemplate.postForEntity(
            baseUrl,
            request,
            {{DtoName}}.class
        );

        // Assert
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getId(), "Created entity should have ID");
        assertEquals({{value1}}, response.getBody().get{{Property1}}());

        // Verify in database
        assertTrue({{repositoryInstance}}.findById(response.getBody().getId()).isPresent());
    }

    @Test
    @DisplayName("should update existing {{resourceName}} via PUT")
    void shouldUpdateExisting{{ResourceName}}ViaPut() {
        // Arrange
        {{EntityName}} existing = {{repositoryInstance}}.findAll().get(0);
        Long id = existing.getId();

        {{DtoName}} updateDto = new {{DtoName}}();
        updateDto.setId(id);
        updateDto.set{{Property}}({{updatedValue}});

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<{{DtoName}}> request = new HttpEntity<>(updateDto, headers);

        String url = baseUrl + "/" + id;

        // Act
        ResponseEntity<{{DtoName}}> response = restTemplate.exchange(
            url,
            HttpMethod.PUT,
            request,
            {{DtoName}}.class
        );

        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals({{updatedValue}}, response.getBody().get{{Property}}());

        // Verify in database
        {{EntityName}} updated = {{repositoryInstance}}.findById(id).orElseThrow();
        assertEquals({{updatedValue}}, updated.get{{Property}}());
    }

    @Test
    @DisplayName("should delete {{resourceName}} via DELETE")
    void shouldDelete{{ResourceName}}ViaDelete() {
        // Arrange
        {{EntityName}} existing = {{repositoryInstance}}.findAll().get(0);
        Long id = existing.getId();
        String url = baseUrl + "/" + id;

        // Act
        ResponseEntity<Void> response = restTemplate.exchange(
            url,
            HttpMethod.DELETE,
            null,
            Void.class
        );

        // Assert
        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());

        // Verify deleted from database
        assertFalse({{repositoryInstance}}.findById(id).isPresent());
    }

    @Test
    @DisplayName("should return 400 BAD REQUEST for invalid input")
    void shouldReturn400BadRequestForInvalidInput() {
        // Arrange
        {{DtoName}} invalidDto = new {{DtoName}}();
        // Don't set required fields

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<{{DtoName}}> request = new HttpEntity<>(invalidDto, headers);

        // Act
        ResponseEntity<String> response = restTemplate.postForEntity(
            baseUrl,
            request,
            String.class
        );

        // Assert
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    // ==================== SQL SCRIPT TESTS ====================

    @Test
    @DisplayName("should load test data from SQL script")
    @Sql("/test-data/{{test-script}}.sql") // Load SQL script before test
    void shouldLoadTestDataFromSqlScript() {
        // Act
        List<{{EntityName}}> all = {{repositoryInstance}}.findAll();

        // Assert
        assertEquals({{expectedCount}}, all.size(), "Should have loaded entities from SQL script");
    }
}
```

## Test Configuration File

Create `src/test/resources/application-test.yml`:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
    username: sa
    password:

  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
    properties:
      hibernate:
        format_sql: true

  h2:
    console:
      enabled: true

logging:
  level:
    org.springframework: INFO
    com.example: DEBUG
```

## Adaptation Rules

- [ ] Replace `{{ComponentName}}` with service/controller/component name
- [ ] Replace `{{RepositoryName}}` and `{{repositoryInstance}}` with actual repository
- [ ] Replace `{{EntityName}}` with JPA entity class name
- [ ] Replace `{{DtoName}}` with DTO class name
- [ ] Replace `{{resourcePath}}` with REST API path (e.g., "users", "products")
- [ ] Use `@Transactional` for automatic database rollback
- [ ] Use `@ActiveProfiles("test")` to load test configuration
- [ ] Add `@Sql` annotations to load test data from SQL scripts
- [ ] Test all HTTP methods: GET, POST, PUT, DELETE
- [ ] Verify both HTTP response and database state
- [ ] Use `TestRestTemplate` for REST API testing
- [ ] Use `@LocalServerPort` for dynamic port in tests

## Related

- Template: @templates/junit/BasicUnitTest.java (for unit testing components)
- Template: @templates/junit/MockTest.java (for mocking dependencies)

## Example: User Service Integration Test

```java
package com.example.user;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.example.user.repository.UserRepository;
import com.example.user.model.User;
import com.example.user.dto.UserDto;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
@DisplayName("User API Integration Tests")
class UserIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    private String baseUrl;

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api/users";
        userRepository.deleteAll();

        // Create test user
        User testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        userRepository.save(testUser);
    }

    @Test
    @DisplayName("should create new user via POST")
    void shouldCreateNewUserViaPost() {
        // Arrange
        UserDto newUser = new UserDto();
        newUser.setUsername("newuser");
        newUser.setEmail("new@example.com");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<UserDto> request = new HttpEntity<>(newUser, headers);

        // Act
        ResponseEntity<UserDto> response = restTemplate.postForEntity(
            baseUrl,
            request,
            UserDto.class
        );

        // Assert
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getId());
        assertEquals("newuser", response.getBody().getUsername());
        assertEquals("new@example.com", response.getBody().getEmail());

        // Verify in database
        assertTrue(userRepository.findById(response.getBody().getId()).isPresent());
    }

    @Test
    @DisplayName("should find user by username")
    void shouldFindUserByUsername() {
        // Arrange
        String username = "testuser";

        // Act
        List<User> users = userRepository.findByUsername(username);

        // Assert
        assertFalse(users.isEmpty());
        assertEquals(1, users.size());
        assertEquals(username, users.get(0).getUsername());
    }

    @Test
    @DisplayName("should return 400 for duplicate username")
    void shouldReturn400ForDuplicateUsername() {
        // Arrange
        UserDto duplicateUser = new UserDto();
        duplicateUser.setUsername("testuser"); // Already exists
        duplicateUser.setEmail("another@example.com");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<UserDto> request = new HttpEntity<>(duplicateUser, headers);

        // Act
        ResponseEntity<String> response = restTemplate.postForEntity(
            baseUrl,
            request,
            String.class
        );

        // Assert
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }
}
```

## Notes

### @Transactional Behavior

`@Transactional` on test class causes automatic rollback after each test:
- Changes are visible within the test
- Database returns to clean state after test completes
- No need for manual cleanup in `@AfterEach`

### Test Profiles

Use `@ActiveProfiles("test")` to:
- Load `application-test.yml` or `application-test.properties`
- Use in-memory H2 database instead of production database
- Configure faster test-specific settings

### TestRestTemplate vs MockMvc

**TestRestTemplate**: Full integration testing with actual HTTP
- Starts embedded server
- Real HTTP requests
- Tests entire stack

**MockMvc**: Controller layer testing without HTTP
- No server startup
- Faster execution
- More control over request/response

Choose TestRestTemplate for true end-to-end API tests.
