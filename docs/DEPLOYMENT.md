# Deployment guide

## Single-host Compose deployment

1. Provision an isolated Linux host with Docker Engine and Compose.
2. Clone the repository and create `.env` from `.env.example`.
3. Set a random JWT secret, set `DOCKER_GID` to the Docker socket group ID on Linux (default `999`), and bind the published app port to a trusted network/firewall.
4. Run `docker compose up --build -d` and verify `GET /api/health`.
5. Bootstrap an admin in the running container with the documented admin script and an interactive/private credential workflow; do not place a password in a committed file.
6. Back up the `app-data` volume. Set `COOKIE_SECURE=true` when TLS is terminated by a trusted reverse proxy.

The included Compose service mounts `/var/run/docker.sock`, allowing the app to create sample containers. This is equivalent to granting powerful control over the Docker host. Restrict dashboard access, isolate the host, and never expose the socket over TCP or run untrusted tenants on it.

## GitHub Actions Docker-host deployment

To use `.github/workflows/deploy.yml`, add the protected `production` GitHub environment and configure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS` as environment secrets. On the host, provision `/etc/devops-build-system.env` with the runtime variables (including a unique `JWT_SECRET`) and install Docker. Trigger the workflow from the commit to deploy; it transfers that commit's image, starts the managed container, and waits for health. The SSH public key should be restricted to the deployment account/host; the workflow verifies a pre-provisioned host key rather than trusting a runtime scan.

## Managed application deployment

Create an application, start a build, and wait for status `Success`. The deployment action rebuilds the fixed `sample-web` Docker image and launches it with a generated name, `--rm`, and a random port bound only to `127.0.0.1`. It waits for the container's Docker health check before reporting success. The returned URL is intended for local demonstration on the deployment host. Docker daemon/network unavailability marks the deployment `Failed` and stores a log entry.

## Production considerations

- Use HTTPS, secure cookies, a secret manager, rate limits, and admin MFA/SSO.
- Restrict Docker access with a dedicated deployment service/worker and policy; avoid mounting the host socket into a public web process.
- Use a managed relational database for multiple replicas and robust backups.
- Add deployment reconciliation, image digest pinning, resource quotas, retention policies, and external monitoring before production use.
- Configure GitHub environment protection and a reviewed, host-specific rollout/rollback command in the manual deployment workflow.
