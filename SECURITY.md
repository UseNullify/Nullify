# Security

Read this before trusting Nulify with anything that matters.

## Current state

This is pre-audit, experimental software. The contracts and circuit run and pass local tests, but
nothing here has been independently reviewed. The trusted setup that ships with the repo is a
development powers-of-tau, not a real ceremony, which means it is fine for testing and unsafe for
real funds. Do not deploy this to mainnet, and do not put money you care about into it.

Two things have to happen before any mainnet use:

1. A public, multi-party trusted-setup ceremony.
2. An external audit covering both the circuit and the contracts.

## Reporting a vulnerability

Please report privately. Do not open a public issue for a security bug.

The preferred channel is a private security advisory on the GitHub repo (Security tab, "Report a
vulnerability"). If you would rather email, reach me at nullify7714@gmail.com.

Give me a reasonable window to fix things before going public. There is no paid bounty yet; that
can change once there is something live worth protecting.

## What is in scope

- Circuit soundness, including any way to produce a valid proof for a note you do not own.
- Contract logic: the pool, the verifier, and the payout path.
- The relayer's checks before it submits a withdrawal.
- The SDK's proof construction.

## What is out of scope (for now)

- Anything that needs a dishonest majority of the cross-chain attestor signer set. That is a known,
  documented assumption, not a finding.
- Third-party RPC providers and user key management.
- The development trusted setup being single-party. That is by design for now and already called
  out above.

## Known assumptions

These are deliberate and documented, not oversights:

- The trusted setup is honest (dev setup today, real ceremony before mainnet).
- The cross-chain attestor majority is honest.
- At least one relayer is reachable and willing to submit.

More detail on the trust model is in docs/architecture.md and docs/privacy-design.md.
