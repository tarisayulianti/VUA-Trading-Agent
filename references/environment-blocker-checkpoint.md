# Environment Blocker Checkpoint Pattern
Pattern from VUA P0-002 session (2026-08-31): document real command output, record exit codes, no workaround (no SQLite/mock/fake DB), update status file + master map, source untouched until blocker resolved.
Resume conditions: Docker daemon reachable + PostgreSQL container + Prisma install + migration apply + DB connection + schema validation + transaction test.
