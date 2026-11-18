# API reference

All routes are served under `/api`. JSON request bodies are limited to 32 KB. Authenticated requests use the HTTP-only `access_token` cookie; send requests with credentials enabled. Registration cannot set a role.

## Health and authentication

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | API and SQLite readiness |
| POST | `/auth/register` | Public | `{ "name", "email", "password" }`; password minimum 10 chars |
| POST | `/auth/login` | Public | `{ "email", "password" }`; sets session cookie |
| POST | `/auth/logout` | Public | Clears the session cookie |
| GET | `/me` | User | Current account |

## Applications and delivery

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/applications` | User | List own apps; admins see all |
| POST | `/applications` | User | `{ "name", "description?", "template": "sample-web" }` |
| GET | `/applications/:id` | Owner/admin | Application details |
| POST | `/applications/:id/builds` | Owner/admin | Queue actual sample build; `202` with Pending record |
| GET | `/builds` | User | Own build history; admins see all |
| GET | `/builds/:id/logs` | Owner/admin | Captured build output |
| POST | `/applications/:id/deployments` | Owner/admin | Requires latest successful build |
| GET | `/deployments` | User | Own deployment history; admins see all |

## Administration

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin | User, application, build and deployment totals |
| GET | `/admin/users` | Admin | User listing and application counts |
| PATCH | `/admin/users/:id` | Admin | `{ "role": "admin|user", "active": true|false }` |
| GET | `/admin/activity` | Admin | Latest 100 audit events |

Validation errors return HTTP 400 with field details. Unauthorized and unauthorized-resource responses use 401/403/404. A deployment without a successful build returns 409. Health returns 503 if SQLite cannot be queried.
