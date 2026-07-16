# DDS — Security Plan

## Version 1.0

---

## 1. Security Philosophy

Defense in depth. No single layer is trusted. Every request is authenticated, validated, logged, and rate-limited.

---

## 2. Authentication

### 2.1 Password Policy
- Minimum 8 characters, no maximum
- bcrypt hashing with cost factor 12 (~250ms per hash)
- No plaintext storage, logging, or transmission
- Rate limited to 5 attempts per email per minute

### 2.2 JWT Tokens
- Signed with HS256 (512-bit secret from `JWT_SECRET` env var)
- Access token: 24-hour expiry
- Refresh token rotation not implemented in V1 (deferred to V2)
- Token sent in `Authorization: Bearer <token>` header (never in URL)
- No sensitive data in JWT payload (only `sub`, `role`, `iat`, `exp`)

### 2.3 Session Management
- Server-side session tracking via `sessions` table (token hash)
- Logout invalidates token by removing session record
- Password change invalidates all existing sessions

---

## 3. Input Validation & Sanitization

### 3.1 API Boundary
- Every request body validated against Zod schema before reaching controllers
- Zod strips unknown fields by default
- String trimming and email normalization applied
- UUID parameters validated with `uuid()` Zod schema
- Numeric fields range-checked

### 3.2 SQL Injection
- Prevented by Drizzle ORM (parameterized queries)
- No raw SQL in V1 codebase
- Full-text search uses PostgreSQL `tsvector`, not string interpolation

### 3.3 XSS Prevention
- React handles output encoding by default
- API returns JSON only (no HTML rendering)
- Helmet middleware sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- Content-Security-Policy header set by Helmet

---

## 4. API Security

### 4.1 Rate Limiting
| Endpoint Group | Limit | Window |
|---|---|---|
| Auth (login) | 5 requests | 1 minute per IP |
| General API | 100 requests | 1 minute per token |
| Diagnostic upload | 30 requests | 1 minute per token |

### 4.2 Request Size Limits
- JSON body: 10MB (accommodates large diagnostic payloads)
- File uploads (V2): 50MB

### 4.3 CORS
- Restricted to frontend origin (configured via `CORS_ORIGIN` env var)
- No wildcard in production
- Credentials: true

### 4.4 Headers (Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (disabled, redundant with React)
- `Strict-Transport-Security: max-age=31536000` (if HTTPS)
- `Content-Security-Policy: default-src 'self'`

---

## 5. Data Security

### 5.1 At Rest
- Passwords: bcrypt hashed (never reversible)
- JWT secrets: environment variable, never in code
- Database: No encryption at rest in V1 (Raspberry Pi limitation; deferred to V2 with LUKS or cloud-hosted PostgreSQL)

### 5.2 In Transit
- API exposed on HTTP in development
- Production MUST use reverse proxy (Traefik/Nginx) with Let's Encrypt TLS
- Frontend served over HTTPS in production

### 5.3 Audit Logging
All the following operations are logged to `audit_logs`:
| Action | Entities |
|---|---|
| CREATE | customer, device, diagnostic, report |
| UPDATE | customer, device |
| DELETE | customer, device, diagnostic, report |
| VIEW | diagnostic (sensitive hardware data) |

Each audit record includes: actor ID, timestamp, IP address, action, entity type, entity ID, and changed fields.

---

## 6. Infrastructure Security

### 6.1 Docker
- Containers run as non-root user (UID 1000)
- No privileged containers
- Read-only root filesystem where possible
- Health checks prevent routing to unhealthy containers

### 6.2 Environment Variables
- `.env` files never committed to version control
- `.env.example` contains dummy values with documentation
- Production secrets injected via Docker secrets or CI/CD vault

### 6.3 Dependencies
- `pnpm audit` run in CI pipeline
- `dependabot` configured for automated PR updates
- Regular `pnpm update` for patch versions

---

## 7. Incident Response (V1)

| Scenario | Response |
|---|---|
| Failed login rate limit triggered | Log warning, return 429, no account lockout (V2) |
| Invalid JWT presented | Log warning, return 401 |
| Validation failure | Log debug, return 400 with details |
| Unhandled server error | Log error with stack trace, return 500 (no stack to client) |
| Database connection loss | Log critical, return 503, attempt reconnect |

---

## 8. V2 Security Improvements (Not Implemented)

- Refresh token rotation
- Multi-factor authentication
- IP-based allowlisting
- Database encryption at rest
- Secrets rotation
- Penetration testing
- Security audit logging dashboard
