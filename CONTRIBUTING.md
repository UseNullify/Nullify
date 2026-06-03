# Contributing

Contributions are welcome. This is an early project, so the most useful thing you can do is read
the code critically and tell me where it is wrong.

## Before you write code

Skim docs/architecture.md and docs/privacy-design.md first. Anything that touches the trust model,
the size of the anonymity set, or the circuit's public inputs should start as an issue so we can
talk it through before you spend time on a PR.

## Getting set up

```
npm install
npm run ptau
npm run circuits:build
npm run e2e
npm run negative-test
```

If e2e prints "E2E OK" and the negative tests all pass, your environment is good.

## Sending a change

1. Branch off main.
2. Make the change, with a test for it.
3. Run the test suite. e2e and the negative tests must stay green.
4. Open a PR that says what changed and why, and flag any privacy or trust implications.

Keep commits readable. Conventional prefixes (feat, fix, docs, test, chore) are appreciated but not
enforced.

## Circuit and contract changes

These are the high-risk areas. If you touch the circuit or the public-signal layout, update the
docs and the SDK in the same PR, and say clearly whether a new trusted setup is required. A change
that quietly alters what the circuit proves is the kind of thing that drains a pool, so it gets
extra scrutiny.

## One ask

Do not contribute features whose main purpose is to defeat lawful investigation or to help with
sanctions evasion or money laundering. Nulify is privacy infrastructure for lawful, self-custodial
use. See the responsible-use note in the README.
