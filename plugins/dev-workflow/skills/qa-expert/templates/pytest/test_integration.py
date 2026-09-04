# Template: Integration Test

**When to Use**: Testing database interactions, API calls, file system operations, message queues, external services, or any code that integrates multiple components together.

**Complexity**: Medium

**Common Mistakes Agents Make**:
- Not using fixtures for setup/teardown, causing test pollution
- Tests sharing state or depending on execution order
- Not isolating tests from each other (writing to same DB rows)
- Forgetting to clean up resources (files, DB connections, temp data)
- Not using transactions or rollback strategies for database tests
- Testing too much in one test (should test one integration path)
- Not verifying side effects (DB writes, file creation)
- Using production database instead of test database

## Template

```python
"""
Integration tests for {{module_name}} with {{external_system}}.

Tests the integration between {{component1}} and {{component2}},
ensuring they work correctly together with real {{database/filesystem/api}}.
"""
from typing import List, Dict, Any, Optional, Generator
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from {{package_name}}.{{module_name}} import (
    {{service_class}},
    {{repository_class}},
    {{model_class}},
)
from {{package_name}}.database import Base


# ============================================================================
# FIXTURES - Database setup and cleanup
# ============================================================================

@pytest.fixture(scope="session")
def database_engine():
    """
    Create a test database engine for the entire test session.

    Yields:
        Engine: SQLAlchemy engine connected to test database
    """
    # Use in-memory SQLite for fast tests, or test database
    engine = create_engine("sqlite:///:memory:", echo=False)
    # For PostgreSQL: "postgresql://test:test@localhost/test_db"

    # Create all tables
    Base.metadata.create_all(engine)

    yield engine

    # Cleanup
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(database_engine) -> Generator[Session, None, None]:
    """
    Provide a database session for a single test with automatic rollback.

    Each test gets a fresh session with a transaction that's rolled back
    after the test completes, ensuring test isolation.

    Yields:
        Session: SQLAlchemy session for database operations
    """
    connection = database_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()

    yield session

    # Rollback transaction to isolate tests
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def {{repository_fixture}}(db_session: Session) -> {{RepositoryClass}}:
    """
    Provide a {{RepositoryClass}} instance with test database session.

    Args:
        db_session: Test database session

    Returns:
        {{RepositoryClass}}: Repository instance for testing
    """
    return {{RepositoryClass}}(session=db_session)


@pytest.fixture
def {{service_fixture}}({{repository_fixture}}: {{RepositoryClass}}) -> {{ServiceClass}}:
    """
    Provide a {{ServiceClass}} instance with test dependencies.

    Args:
        {{repository_fixture}}: Repository fixture

    Returns:
        {{ServiceClass}}: Service instance for testing
    """
    return {{ServiceClass}}(repository={{repository_fixture}})


@pytest.fixture
def {{sample_entity}}(db_session: Session) -> {{EntityClass}}:
    """
    Create and persist a sample {{entity}} for testing.

    Args:
        db_session: Database session

    Returns:
        {{EntityClass}}: Persisted entity instance
    """
    entity = {{EntityClass}}(
        {{field1}}="{{value1}}",
        {{field2}}={{value2}},
    )
    db_session.add(entity)
    db_session.commit()
    db_session.refresh(entity)
    return entity


@pytest.fixture
def {{multiple_entities_fixture}}(db_session: Session) -> List[{{EntityClass}}]:
    """
    Create multiple {{entity}} instances for testing queries.

    Args:
        db_session: Database session

    Returns:
        List[{{EntityClass}}]: List of persisted entities
    """
    entities = [
        {{EntityClass}}({{field}}=f"{{value}}{i}")
        for i in range({{count}})
    ]
    db_session.add_all(entities)
    db_session.commit()
    for entity in entities:
        db_session.refresh(entity)
    return entities


# ============================================================================
# FIXTURES - File system setup
# ============================================================================

@pytest.fixture
def temp_directory(tmp_path: Path) -> Path:
    """
    Provide a temporary directory for file operations.

    Pytest automatically cleans up tmp_path after the test.

    Args:
        tmp_path: Pytest's temporary directory fixture

    Returns:
        Path: Path to temporary directory
    """
    test_dir = tmp_path / "{{test_subdir}}"
    test_dir.mkdir(parents=True, exist_ok=True)
    return test_dir


@pytest.fixture
def {{sample_file}}(temp_directory: Path) -> Path:
    """
    Create a sample file for testing file operations.

    Args:
        temp_directory: Temporary directory path

    Returns:
        Path: Path to created sample file
    """
    file_path = temp_directory / "{{sample_filename}}"
    file_path.write_text("{{sample_content}}")
    return file_path


# ============================================================================
# TESTS - Database Integration - Create Operations
# ============================================================================

class TestDatabaseCreate:
    """Tests for creating entities in database."""

    def test_create_{{entity}}_persists_to_database(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        db_session: Session
    ):
        """
        Test creating {{entity}} successfully persists to database.

        GIVEN: Valid {{entity}} data
        WHEN: Repository creates {{entity}}
        THEN: {{entity}} should be persisted and retrievable
        """
        # Arrange
        {{entity}}_data = {
            "{{field1}}": "{{value1}}",
            "{{field2}}": {{value2}},
        }

        # Act
        created_{{entity}} = {{repository_fixture}}.create({{entity}}_data)
        db_session.commit()

        # Assert
        assert created_{{entity}}.id is not None
        retrieved = db_session.get({{EntityClass}}, created_{{entity}}.id)
        assert retrieved is not None
        assert retrieved.{{field1}} == "{{value1}}"

    def test_create_{{entity}}_with_missing_required_field_fails(
        self,
        {{repository_fixture}}: {{RepositoryClass}}
    ):
        """
        Test creating {{entity}} without required field raises error.

        GIVEN: {{entity}} data missing required field
        WHEN: Repository attempts to create {{entity}}
        THEN: Should raise {{ExceptionType}}
        """
        # Arrange
        invalid_data = {
            "{{field1}}": "{{value1}}",
            # Missing required {{field2}}
        }

        # Act & Assert
        with pytest.raises({{ExceptionType}}):
            {{repository_fixture}}.create(invalid_data)

    def test_create_duplicate_{{entity}}_fails(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        {{sample_entity}}: {{EntityClass}}
    ):
        """
        Test creating {{entity}} with duplicate unique field fails.

        GIVEN: Existing {{entity}} with unique {{field}}
        WHEN: Attempting to create another with same {{field}}
        THEN: Should raise IntegrityError
        """
        # Arrange
        duplicate_data = {
            "{{unique_field}}": {{sample_entity}}.{{unique_field}},
            "{{other_field}}": "{{different_value}}",
        }

        # Act & Assert
        with pytest.raises(IntegrityError):
            {{repository_fixture}}.create(duplicate_data)


# ============================================================================
# TESTS - Database Integration - Read Operations
# ============================================================================

class TestDatabaseRead:
    """Tests for reading entities from database."""

    def test_get_{{entity}}_by_id_returns_correct_entity(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        {{sample_entity}}: {{EntityClass}}
    ):
        """
        Test retrieving {{entity}} by ID returns correct entity.

        GIVEN: Existing {{entity}} in database
        WHEN: Repository retrieves by ID
        THEN: Should return entity with matching attributes
        """
        # Act
        retrieved = {{repository_fixture}}.get_by_id({{sample_entity}}.id)

        # Assert
        assert retrieved is not None
        assert retrieved.id == {{sample_entity}}.id
        assert retrieved.{{field1}} == {{sample_entity}}.{{field1}}

    def test_get_{{entity}}_by_nonexistent_id_returns_none(
        self,
        {{repository_fixture}}: {{RepositoryClass}}
    ):
        """
        Test retrieving {{entity}} with non-existent ID returns None.

        GIVEN: Non-existent {{entity}} ID
        WHEN: Repository retrieves by ID
        THEN: Should return None
        """
        # Arrange
        nonexistent_id = {{large_id_value}}

        # Act
        result = {{repository_fixture}}.get_by_id(nonexistent_id)

        # Assert
        assert result is None

    def test_list_all_{{entities}}_returns_all_records(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        {{multiple_entities_fixture}}: List[{{EntityClass}}]
    ):
        """
        Test listing all {{entities}} returns correct count.

        GIVEN: Multiple {{entities}} in database
        WHEN: Repository lists all {{entities}}
        THEN: Should return all persisted {{entities}}
        """
        # Act
        all_{{entities}} = {{repository_fixture}}.list_all()

        # Assert
        assert len(all_{{entities}}) == len({{multiple_entities_fixture}})
        ids = [e.id for e in all_{{entities}}]
        assert all(e.id in ids for e in {{multiple_entities_fixture}})

    def test_filter_{{entities}}_by_{{criteria}}_returns_matches(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        db_session: Session
    ):
        """
        Test filtering {{entities}} by {{criteria}} returns only matches.

        GIVEN: {{entities}} with different {{criteria}} values
        WHEN: Repository filters by specific {{criteria}}
        THEN: Should return only matching {{entities}}
        """
        # Arrange
        entity1 = {{EntityClass}}({{field}}="{{match_value}}")
        entity2 = {{EntityClass}}({{field}}="{{different_value}}")
        db_session.add_all([entity1, entity2])
        db_session.commit()

        # Act
        results = {{repository_fixture}}.filter_by_{{criteria}}("{{match_value}}")

        # Assert
        assert len(results) == 1
        assert results[0].{{field}} == "{{match_value}}"


# ============================================================================
# TESTS - Database Integration - Update Operations
# ============================================================================

class TestDatabaseUpdate:
    """Tests for updating entities in database."""

    def test_update_{{entity}}_modifies_database_record(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        {{sample_entity}}: {{EntityClass}},
        db_session: Session
    ):
        """
        Test updating {{entity}} persists changes to database.

        GIVEN: Existing {{entity}} in database
        WHEN: Repository updates {{entity}} attributes
        THEN: Changes should be persisted to database
        """
        # Arrange
        new_{{field}} = "{{updated_value}}"
        update_data = {"{{field}}": new_{{field}}}

        # Act
        updated = {{repository_fixture}}.update({{sample_entity}}.id, update_data)
        db_session.commit()

        # Assert
        assert updated.{{field}} == new_{{field}}
        db_session.refresh({{sample_entity}})
        assert {{sample_entity}}.{{field}} == new_{{field}}

    def test_update_nonexistent_{{entity}}_raises_error(
        self,
        {{repository_fixture}}: {{RepositoryClass}}
    ):
        """
        Test updating non-existent {{entity}} raises error.

        GIVEN: Non-existent {{entity}} ID
        WHEN: Repository attempts to update
        THEN: Should raise {{ExceptionType}}
        """
        # Arrange
        nonexistent_id = {{large_id_value}}
        update_data = {"{{field}}": "{{value}}"}

        # Act & Assert
        with pytest.raises({{ExceptionType}}):
            {{repository_fixture}}.update(nonexistent_id, update_data)


# ============================================================================
# TESTS - Database Integration - Delete Operations
# ============================================================================

class TestDatabaseDelete:
    """Tests for deleting entities from database."""

    def test_delete_{{entity}}_removes_from_database(
        self,
        {{repository_fixture}}: {{RepositoryClass}},
        {{sample_entity}}: {{EntityClass}},
        db_session: Session
    ):
        """
        Test deleting {{entity}} removes it from database.

        GIVEN: Existing {{entity}} in database
        WHEN: Repository deletes {{entity}}
        THEN: {{entity}} should no longer be retrievable
        """
        # Arrange
        {{entity}}_id = {{sample_entity}}.id

        # Act
        {{repository_fixture}}.delete({{entity}}_id)
        db_session.commit()

        # Assert
        deleted = db_session.get({{EntityClass}}, {{entity}}_id)
        assert deleted is None

    def test_delete_nonexistent_{{entity}}_raises_error(
        self,
        {{repository_fixture}}: {{RepositoryClass}}
    ):
        """
        Test deleting non-existent {{entity}} raises error.

        GIVEN: Non-existent {{entity}} ID
        WHEN: Repository attempts to delete
        THEN: Should raise {{ExceptionType}}
        """
        # Arrange
        nonexistent_id = {{large_id_value}}

        # Act & Assert
        with pytest.raises({{ExceptionType}}):
            {{repository_fixture}}.delete(nonexistent_id)


# ============================================================================
# TESTS - File System Integration
# ============================================================================

class TestFileSystemIntegration:
    """Tests for file system operations."""

    def test_save_data_to_file_creates_file(
        self,
        {{service_fixture}}: {{ServiceClass}},
        temp_directory: Path
    ):
        """
        Test saving data creates file with correct content.

        GIVEN: Data to save and target directory
        WHEN: Service saves data to file
        THEN: File should exist with correct content
        """
        # Arrange
        data = {"{{key}}": "{{value}}"}
        file_path = temp_directory / "{{output_file}}"

        # Act
        {{service_fixture}}.save_to_file(data, file_path)

        # Assert
        assert file_path.exists()
        content = file_path.read_text()
        assert "{{expected_content}}" in content

    def test_load_data_from_file_reads_correctly(
        self,
        {{service_fixture}}: {{ServiceClass}},
        {{sample_file}}: Path
    ):
        """
        Test loading data from file returns correct data.

        GIVEN: Existing file with data
        WHEN: Service loads from file
        THEN: Should return parsed data
        """
        # Act
        data = {{service_fixture}}.load_from_file({{sample_file}})

        # Assert
        assert data is not None
        assert "{{expected_key}}" in data

    def test_delete_file_removes_file(
        self,
        {{service_fixture}}: {{ServiceClass}},
        {{sample_file}}: Path
    ):
        """
        Test deleting file removes it from filesystem.

        GIVEN: Existing file
        WHEN: Service deletes file
        THEN: File should no longer exist
        """
        # Arrange
        assert {{sample_file}}.exists()

        # Act
        {{service_fixture}}.delete_file({{sample_file}})

        # Assert
        assert not {{sample_file}}.exists()


# ============================================================================
# TESTS - Service Integration (Multiple Components)
# ============================================================================

class TestServiceIntegration:
    """Tests for service layer integrating multiple components."""

    def test_{{workflow}}_integrates_repository_and_logic(
        self,
        {{service_fixture}}: {{ServiceClass}},
        db_session: Session
    ):
        """
        Test {{workflow}} correctly integrates repository and business logic.

        GIVEN: Service with dependencies
        WHEN: {{workflow}} is executed
        THEN: Should persist data and apply business logic
        """
        # Arrange
        input_data = {"{{field}}": "{{value}}"}

        # Act
        result = {{service_fixture}}.{{workflow}}(input_data)

        # Assert
        assert result.id is not None
        assert result.{{computed_field}} == {{expected_value}}

        # Verify database side effect
        persisted = db_session.get({{EntityClass}}, result.id)
        assert persisted is not None
```

## Adaptation Rules

- [ ] Replace `{{module_name}}`, `{{external_system}}` with actual names
- [ ] Choose appropriate database (SQLite for fast tests, PostgreSQL for production-like tests)
- [ ] Update imports to match your ORM (SQLAlchemy, Django ORM, etc.)
- [ ] Remove fixture scopes you don't need (session, function, class)
- [ ] Ensure proper cleanup in fixtures (rollback, file deletion)
- [ ] Use transactions for database test isolation
- [ ] Add fixtures for your specific external systems
- [ ] Test both happy paths and error conditions
- [ ] Verify side effects (database writes, file creation)
- [ ] Use `tmp_path` fixture for file operations

## Related

- Rule: @rules/pytest-fixtures.md (fixture best practices)
- Rule: @rules/test-isolation.md (ensuring test independence)
- Template: @templates/pytest/test_basic_unit.py (for testing without external dependencies)
- Pattern: @patterns/database-testing.md (database testing strategies)

## pytest.ini Configuration for Integration Tests

```ini
[pytest]
markers =
    integration: marks tests as integration tests (deselect with '-m "not integration"')
    slow: marks tests as slow (deselect with '-m "not slow"')
    database: marks tests requiring database
    filesystem: marks tests requiring filesystem

# Run only integration tests
# pytest -m integration

# Skip integration tests
# pytest -m "not integration"
```

## Notes

### Database Test Isolation

Use transactions with rollback for perfect isolation:

```python
@pytest.fixture
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()  # Rollback ensures no data persists
    connection.close()
```

### File System Testing

Always use `tmp_path` fixture:

```python
def test_file_operation(tmp_path):
    # tmp_path is automatically cleaned up
    file = tmp_path / "test.txt"
    file.write_text("test")
    assert file.exists()
```

### Fixture Scope Best Practices

- `scope="session"`: Database engine, API client setup
- `scope="function"`: Database transactions, temp files (default)
- `scope="class"`: Shared expensive setup for test class

### Testing Side Effects

Always verify side effects after operations:

```python
def test_create_user(repository, db_session):
    # Act
    user = repository.create({"name": "Test"})

    # Assert - verify returned object
    assert user.id is not None

    # Assert - verify database side effect
    db_user = db_session.get(User, user.id)
    assert db_user is not None
```
