# Contributing to Custom Domain SDK

Thank you for your interest in contributing to the Custom Domain SDK! We welcome contributions from the community to help make this SDK more robust and feature-rich.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (version 1.3.0 or higher)
- [Node.js](https://nodejs.org/) (optional, for compatibility testing)

### Local Setup

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/kanakkholwal/custom-domain-sdk.git
   cd custom-domain-sdk
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```

## Development Workflow

### Branching

- Create a new branch for each feature or bugfix:
  ```bash
  git checkout -b feature/your-feature-name
  # or
  git checkout -b fix/your-bug-name
  ```

### Coding Standards

- We use TypeScript for all core logic.
- Follow the existing code style.
- Use meaningful variable and function names.
- Document public APIs using JSDoc.

### Implementation Guidelines

- **Stay Agnostic**: Ensure that any new core features remain independent of specific databases or infrastructure providers.
- **State Machine**: If adding new states or transitions, update `src/core/domain.machine.ts` and ensure the state machine remains deterministic.
- **Interfaces**: When adding new capabilities (e.g., a new type of verification), define an interface first.

## Testing

We use `bun test` for our test suite. All contributions must include tests.

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

### Writing Tests

- Unit tests should be placed in the `tests/` directory.
- Ensure that you test both successful paths and error conditions.
- Mock external services (like DNS or Cloudflare) using the internal interfaces.

## Pull Request Process

1. **Keep it focused**: Each PR should address a single issue or feature.
2. **Update Documentation**: If you change or add any public APIs, update `DOCUMENTATION.md` and `README.md` accordingly.
3. **Verify Build**: Ensure the project builds successfully:
   ```bash
   bun run build
   ```
4. **Submit the PR**: Once your tests pass and your code is polished, submit a Pull Request to the `main` branch.
5. **Review**: Maintainers will review your PR. Be prepared to address feedback.

## Questions?

If you have questions or want to discuss a large change before starting, feel free to open an Issue on GitHub.

---

By contributing to this project, you agree that your contributions will be licensed under its [MIT License](LICENSE.md).
