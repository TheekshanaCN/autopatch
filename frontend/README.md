# Autopatch Frontend

Autopatch Frontend is a Next.js UI for the Autopatch backend.

## Features
- Submit GitHub repo URLs
- Live job status & logs
- Artifact viewer (YAML, diff, markdown)
- Pull Request link display

## Tech Stack
- Next.js
- TypeScript
- Tailwind CSS

## Setup

```bash
pnpm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_BASE=
NEXT_PUBLIC_AUTOPATCH_UI_KEY=
```

Run:
```bash
pnpm dev
```
