# Security Policy

## Supported Versions

Only the latest version on the `main` branch is actively maintained and receives security updates.

| Branch | Supported |
|---|---|
| `main` | ✅ Yes |
| older branches | ❌ No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability in this project, please report it responsibly:

1. **Email** the maintainers directly (see the repository contacts or the `package.json` / commit history for contact info).
2. Include as much detail as possible:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce or a proof-of-concept
   - Any suggested mitigations
3. You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Scope

This repository manages Docker Compose configuration and environment variable templates. Security concerns relevant here include:

- Secrets or credentials accidentally committed to the repository
- Insecure default configuration values in `local/envs/` templates
- Container networking or privilege escalation issues in `local/docker-compose.yml`

## Out of scope

- Vulnerabilities in upstream Docker images (`mongo`, `livedemo-backend`, `livedemo-web-app`) — report those to the respective upstream projects.
- Issues in your own locally configured secrets.
