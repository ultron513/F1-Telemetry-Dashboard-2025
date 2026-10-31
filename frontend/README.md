# Pit Wall — frontend

Next.js 16 (App Router) + Tailwind CSS 4 + TanStack Query. All charts are custom SVG components in `components/charts`.

```bash
cp .env.example .env.local      # point NEXT_PUBLIC_API_URL at the backend
npm install
npm run dev                     # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

Key folders: `app/` pages · `components/shell` layout, pickers, notifications · `components/charts` trace stack, track map, strategy gantt, line chart · `components/replay` session replay · `lib/teams.ts` team colour registry · `state/` URL-synced selection, preferences, theme.
