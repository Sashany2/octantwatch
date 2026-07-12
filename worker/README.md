# OCTANT — order intake worker

Takes the order the page submits and forwards it to Telegram. It exists for one
reason: the bot token must never be in the page. Anything the browser can read,
a visitor can read, and a leaked bot token is a bot you no longer own.

## Deploy

You need a (free) Cloudflare account and a Telegram bot.

```bash
cd worker
npm install -g wrangler        # once
wrangler login                 # opens a browser

# a bot, from @BotFather in Telegram — it hands you a token
wrangler secret put BOT_TOKEN

# your own chat id — write to @userinfobot in Telegram and it tells you
wrangler secret put CHAT_ID

wrangler deploy
```

`wrangler deploy` prints the URL, something like

```
https://octant-order.<your-subdomain>.workers.dev
```

Paste that into `ORDER_ENDPOINT` at the top of the module script in
`../index.html`. Until you do, the form knows it has nowhere to send an order and
says so plainly instead of pretending.

## Then prove it works

Do not trust the deploy message. Submit the real form and watch Telegram:

```bash
node ~/.claude/skills/web-quality-gate/check-site.mjs https://octantwatch.xyz/
```

The `dead-form` check has to go green, and a message has to actually arrive in
your chat. Either both happen or the form is still a decoration.

## Notes

- `ALLOWED_ORIGINS` in `src/index.js` is the list of sites allowed to post here.
  Add a domain there before pointing a new site at this worker.
- Everything is validated again inside the worker. The browser's `required` and
  `type="email"` are a courtesy to honest visitors; anyone can POST to this URL
  directly with curl, so the browser's opinion is worth nothing on its own.
- The free tier is 100 000 requests a day. A landing page will not notice it.
