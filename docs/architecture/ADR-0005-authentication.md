# ADR-0005: JWT Authentication with bcrypt

## Status
Accepted

## Context
DDS requires technician authentication to protect customer data, diagnostic information, and audit trails. The auth system must work in a local network environment (Raspberry Pi on shop LAN) without internet dependency, support offline operation, and be simple enough for a solo developer to implement securely.

## Options Considered

| Option | Description |
|---|---|
| JWT + bcrypt | Self-contained tokens, local password hashing |
| Session cookies | Server-side session store, cookie-based |
| OAuth 2.0 / SSO | External identity provider |
| API keys | Static keys per technician |

## Chosen Solution
**JWT (HS256) for token format + bcrypt (cost 12) for password hashing.**

## Reasons
1. **Stateless authentication** — JWT tokens contain all necessary information. The backend doesn't need a session store (though we track token hashes in a `sessions` table for explicit revocation). This supports horizontal scaling when needed.
2. **Offline operation** — JWT verification is purely cryptographic, requiring no external service calls. Critical for a shop environment where internet may be unreliable.
3. **bcrypt cost factor 12** — Balances security (~250ms per hash on Pi 4) against UX. Cost 10 is too fast for GPU brute-force; cost 14 would make login unacceptably slow on Raspberry Pi.
4. **HS256 over RS256** — Simpler key management (single shared secret vs. public/private key pair). RS256 adds operational complexity without proportional benefit for a single-shop deployment behind a LAN.
5. **Token expiry** — 24-hour expiry limits exposure if a token is leaked. Short enough to be safe, long enough to avoid frustrating technicians who may not log in every session.

## Tradeoffs
- **No built-in refresh token rotation** — V1 uses a single long-lived token. If compromised, the attacker has 24 hours. Mitigated by HTTPS requirement and sessions table for explicit revocation.
- **HS256 symmetric key** — If the `JWT_SECRET` is leaked, all tokens can be forged. Mitigated by production secret management (env vars, never in code).
- **No MFA** — Multi-factor authentication deferred to V2. Acceptable for V1 since the system operates on a local network.

## Future Considerations
- Refresh token rotation for V2 (short-lived access tokens + long-lived refresh tokens)
- Optional MFA via TOTP (authenticator app) in V2
- RS256 if multi-service architecture emerges in V3+
- OAuth 2.0 integration for customer portal in V3+
