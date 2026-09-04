This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

The AI features (episode summaries, catch-me-up digest, semantic search,
ask-this-episode chat, auto-generated chapters) need an Anthropic API key.
Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The rest of the app works without it — those features just won't respond.

### New-episode notifications (optional)

Web push needs a few more variables, plus a deployment that can run the
cron in `vercel.json` and reach Vercel Blob. Without them the toggle on the
Library screen simply doesn't appear, and nothing else changes.

Generate a VAPID key pair with `npx web-push generate-vapid-keys`, then set:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # exposed to the browser; it is the key the
                                # browser encrypts to, so this is meant to be public
VAPID_PUBLIC_KEY=               # same value, server side
VAPID_PRIVATE_KEY=              # keep secret
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=                    # Vercel sends this as a bearer token on cron requests
BLOB_READ_WRITE_TOKEN=          # Vercel Blob, stores subscriptions and feed polling state
                                # (required in production; see local testing below)
```

#### Testing push locally

You do not need a Vercel Blob store to try this out. With no
`BLOB_READ_WRITE_TOKEN`, the push store falls back to a JSON file under
`.push-dev/` (gitignored). `next start` runs with `NODE_ENV=production`
even on a laptop, so the fallback also needs an explicit opt-in:

```
PUSH_DEV_STORE=1
```

A real deployment never sets that, and production without a Blob token fails
loudly rather than silently using a disk that serverless instances do not
share — which would look like it worked and then lose every subscription.

Then `npm run build && npm start`, subscribe from the Library screen, and
trigger the cron by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/push/send
```

The cron at `/api/push/send` runs every two hours: it fetches each followed
feed once (conditionally, so unchanged feeds cost a 304), then sends at most
one notification per device per run rather than one per episode.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
