# Testing

Run the project checks from the workspace root:

```powershell
npm ci
npm run lint
npm test
npm run build
```

Jest and Supertest exercise the Express API with an in-memory SQLite database. Coverage includes registration, duplicate/invalid registration, password hashing, login/logout, authentication, admin-only routes, application/template validation, ownership-aware lookup, actual build-success persistence, failed-process status, logs, and health.

The build-service success test invokes the real bundled Node build script. The failure test injects a process runner that returns a non-zero outcome; it verifies failure handling without claiming that a failed build succeeded. Docker deployment needs a running daemon and is intentionally not faked by API tests. To manually verify it, run the app with Docker access, create an application, build it successfully, then deploy it.
