# Contributing

Thank you for your interest in improving livedemo-deploy!

## What lives here

This repository contains the Docker Compose setup for running the livedemo stack locally. Contributions typically fall into one of these categories:

- Improvements to `local/docker-compose.yml` (health checks, volumes, networking)
- Updates to environment variable templates in `local/envs/`
- Documentation fixes or additions to `README.md`
- Bug reports or feature requests via GitHub Issues

## Getting started

1. **Fork** this repository and clone your fork.
2. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/your-change
   ```
3. Make your changes and test them locally:
   ```bash
   docker compose -f local/docker-compose.yml pull
   docker compose -f local/docker-compose.yml up -d
   ```
4. Verify all three containers start cleanly:
   ```bash
   docker compose -f local/docker-compose.yml ps
   ```
5. **Open a Pull Request** against the `main` branch.

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/` | New features or improvements |
| `fix/` | Bug fixes |
| `docs/` | Documentation-only changes |
| `chore/` | Maintenance (dependency bumps, CI tweaks) |

## Commit style

Use short, imperative-mood commit messages:

```
fix: increase mongo healthcheck retries
feat: add redis container
docs: clarify volume reset instructions
```

## Pull request checklist

Before submitting, please ensure:

- [ ] Your branch is up to date with `main`
- [ ] All containers start without errors with `docker compose up -d`
- [ ] Environment variable templates in `local/envs/` are updated if new variables are introduced
- [ ] Documentation in `README.md` reflects any changes

## Reporting issues

Open a [GitHub Issue](../../issues) using the appropriate template (bug report or feature request). Please include:

- Docker version (`docker --version`)
- Docker Compose version (`docker compose version`)
- The output of `docker compose -f local/docker-compose.yml ps` if containers fail to start
- Relevant logs from `docker compose -f local/docker-compose.yml logs`

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
