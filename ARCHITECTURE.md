# Rascal Bot Hybrid Architecture

## Overview
The Rascal Bot will run a single Discord client written in **TypeScript** (Discord.js).  All business logic that can benefit from Rust’s performance and safety will be moved to a native addon compiled with `napi-rs`.  The addon exposes a small, well‑defined API that the TypeScript layer calls via the generated bindings.

```
TypeScript (Discord.js)  <--->  Rust addon (napi-rs)
```

### Responsibilities
| Layer | Responsibility |
|-------|----------------|
| **Discord Layer** | • Connect to Discord Gateway
| | • Register slash commands
| | • Handle interactions, components, and events
| | • Validate context (permissions, guild, channel)
| | • Call Rust functions for business logic
| | • Format responses and send them back to Discord |
| **Rust Layer** | • Core economy engine (balance, deposits, withdrawals)
| | • Game logic (work, daily, shop, bets)
| | • Validation of inputs and state transitions
| | • Database access (SQLite) – single source of truth
| | • Logging (structured, to stdout)
| | • Expose async functions via N-API |

### Communication
* The addon is loaded once at startup.
* All calls are asynchronous (`async fn`) to avoid blocking the event loop.
* Errors are returned as `Result<T, String>` and mapped to Discord error messages.

### Database Layer
The Rust addon owns the SQLite connection.  TypeScript never touches the database directly.  All queries are performed through the addon, ensuring a single source of truth and preventing race conditions.

### Build & Run
* `npm ci` – installs Node dependencies.
* `npm run native:build` – compiles the Rust addon.
* `npm start` – builds TS, loads addon, starts Discord client.

### Testing
* Rust: `cargo test` + `cargo clippy`.
* TypeScript: `npm test`.
* Integration: a small test harness that sends a fake interaction to the bot and asserts the response.

---

## Migration Plan
1. **Audit** – already completed.
2. **Define architecture** – this document.
3. **Prepare communication** – create TypeScript wrappers for Rust functions.
4. **Migrate modules** – start with the `work` command.
5. **Remove old TS logic** – after tests pass.
6. **Add tests** – unit + integration.
7. **CI & docs** – update workflows and README.
