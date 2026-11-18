# Database schema

The application initializes SQLite schema automatically at startup. Foreign-key enforcement is enabled; `DATABASE_PATH` controls the database file.

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Account identity, bcrypt hash, role, active state | Parent of owned applications, requests, and activity |
| `applications` | User-owned app and fixed `sample-web` template | `owner_id` → users |
| `builds` | Requester, status, image tag, execution timestamps | Application and requesting user |
| `deployments` | Container name/ID, URL, status and timestamps | Application, successful build, requester |
| `build_logs` | Timestamped stdout/stderr/system messages | Build |
| `activity_logs` | Auditable auth, application, build, and admin events | Optional user |

Status values are checked by SQLite constraints. Build and deployment history is ordered by database id/time. Applications are removed with their builds/deployments/logs; activity rows remain but retain a null user when an account is deleted. User deletion is intentionally not exposed through the API.

The database file is private runtime state and must not be checked into Git. Docker Compose stores it in the named `app-data` volume.
