---
tags: [github-actions-expert/workflow-syntax]
summary: "Job definitions, needs: dependencies, fan-in from multiple jobs, and conditional job execution"
---

# Job Structure and Dependencies

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build steps

  test:
    needs: build          # explicit dependency
    runs-on: ubuntu-latest

  deploy:
    needs: [build, test]  # fan-in from multiple jobs
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
```
