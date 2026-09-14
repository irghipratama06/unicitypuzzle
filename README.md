# Sphere Puzzle — UCT Testnet

A deploy-ready Next.js 16 puzzle game inspired by the supplied orange/glitch reference image. It implements a 4x4 2048-style game with Easy / Medium / Hard / Expert levels and Sphere Connect on Unicity testnet2.

## What is included

- Supplied image used as the game logo (`public/game-logo.jpeg`).
- Sphere Connect browser integration with `autoConnect`.
- Testnet2 network declaration and least-privilege permissions: `identity:read`, `balance:read`, `transfer:request`.
- UCT testnet coin ID: `f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0`.
- Configurable treasury recipient via `NEXT_PUBLIC_GAME_RECIPIENT`.
- User chooses deposit amount; deposit is sent through the Sphere wallet confirmation UI.
- Deposit becomes session credit, and each round consumes the selected level fee.
- No private keys or mnemonic are handled by the dApp.

## Level defaults

| Level | Entry | Target | Moves |
|---|---:|---:|---:|
| Easy | 5 UCT | 512 | 180 |
| Medium | 10 UCT | 1,024 | 150 |
| Hard | 25 UCT | 2,048 | 120 |
| Expert | 50 UCT | 4,096 | 100 |

Change these in `lib/game.ts`.

## Important production note

This version treats the on-chain treasury transfer as a session credit in the browser. It is **not** an authoritative escrow/ledger and it does not automatically pay prizes. For a real-money tournament/escrow product, add a backend that verifies transfer IDs and maintains a server-side ledger before granting game credit or payouts. Do not trust `localStorage` or client state for balances.

The game also intentionally does not retry an ambiguous Sphere transfer outcome. Sphere Connect documents `INTENT_OUTCOME_UNKNOWN` as an unknown money outcome where the transfer may have happened, so a backend reconciliation flow is required before any retry.

## Local development

```bash
npm install
cp .env.example .env.local
# edit NEXT_PUBLIC_GAME_RECIPIENT
npm run dev
```

## Vercel

1. Create a GitHub repo and push this folder.
2. Import the repo into Vercel.
3. Add `NEXT_PUBLIC_GAME_RECIPIENT` in Project Settings → Environment Variables.
4. Deploy.

The app is a standard Next.js project and Vercel auto-detects Next.js.

## GitHub commands

```bash
git init
git add .
git commit -m "feat: sphere puzzle UCT testnet game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sphere-puzzle.git
git push -u origin main
```

## Sphere configuration

The dApp uses:

- `@unicitylabs/sphere-sdk` 0.17.x
- Sphere Connect protocol 2.1
- Unicity `testnet2` network id 4
- Wallet URL: `https://sphere.unicity.network`

The UCT testnet2 registry currently defines UCT with 18 decimals. The dApp converts human UCT amounts to base units before requesting the `send` intent.
