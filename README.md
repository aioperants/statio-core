# Statio Core

A website, online booking and a client book (CRM) for **one** beauty salon, barber, nail studio or spa.
Open source (Apache 2.0). Run it on your own Vercel account and database, and own everything.

Prefer not to run it yourself? [Statio](https://statiocrm.com) hosts it for you, with more looks and
colours, reminders, offers, a shop, finances and an AI assistant.

## What's in it

| Area | Included |
| --- | --- |
| Website | A fast website in a minimalist look: your name, services and prices, team, photos, hours and map, About, questions, contact details. Built for Google and AI assistants (structured data, sitemap, IndexNow). |
| Online booking | Clients pick services, a person and a time, 24/7. Free times only, confirmation email with a calendar invite, change or cancel link. Bot check (Cloudflare Turnstile). |
| Approvals | Auto-approve, or approve a new client's first booking yourself; limits for new clients and after no-shows. |
| Today and calendar | Visits per person, walk-ins, blocked time, days off, free gaps, today's takings. Close a visit in two taps: amount and how they paid (an internal record, not an invoice). |
| Clients (CRM) | Search, notes, allergies, birthdays, history, no-shows, who is due back (a WhatsApp message in one tap), CSV import (contacts, Excel, Booksy, Fresha) and export. |
| Team | Hours with split shifts, services per person, chairs and shared stations, five access levels. |
| Your data | Download everything at any time (Settings › Download data). |

Works on phone, tablet and computer: add the admin to the home screen like an app. The app is in English; the booking page, website and
emails to clients in English, Spanish, German, French, Italian, Portuguese or Ukrainian.

Double booking is prevented by the database itself, not only by the app.

**Want to see it first?** Try the hosted version free for 14 days, no card needed: [statiocrm.com](https://statiocrm.com).
It's the same app, so everything you try there works here too.

**New here?** Read the step-by-step [How-to guide](docs/GUIDE.md), written for salon owners.

**Why all in one?** Salons give great service and still lose clients: the hairdresser is busy with
hands in someone's hair, the phone rings, nobody tracks who should come back. Statio Core does the
receptionist's job. Clients book themselves on your own website, every booking fills your client
book, and the app tells you who is due back, with a WhatsApp message in one tap. Change a price,
your hours or your team once and it's right everywhere, including what Google and AI assistants
read. More in the [comparison](docs/COMPARISON.md#the-real-problem-the-client-relationship-breaks).

## What you need

| | Cost |
| --- | --- |
| A GitHub account, to hold your copy | Free |
| **Vercel Pro** (required), to run it | $20 a month. A salon taking real bookings is commercial use, which needs Vercel Pro |
| A Neon Postgres database, created inside Vercel | Free plan |
| An email sender (required): [Resend](https://resend.com) or your own mailbox | Free plan |
| Your own domain, e.g. `yoursalon.com` | About 10–20 € a year |

## A free alternative to Booksy and Fresha

No monthly fee per person and no share of new clients: a 5-person salon pays about $21 a month in
running costs (Vercel Pro and a domain), and owns its website, booking page and client list. See the
honest [comparison with Booksy, Fresha, Vagaro, Square Appointments, GlossGenius, Mangomint and Salonist](docs/COMPARISON.md),
including what Statio Core doesn't do.

## Run it yourself, or let us run it?

| | Statio Core (you run it) | Statio Starter (we run it) |
| --- | --- | --- |
| Price | Free software | 29 € / $29 a month, free trial |
| Hosting | Vercel Pro, $20 a month for a business | Included |
| Domain | Yours, about 10–20 € a year | An address on statiocrm.com, or connect your own |
| Database, email, backups | You set them up and look after them | Included |
| Updates and security fixes | You apply them (Sync fork) | Automatic |
| Help | GitHub issues | Support from the Statio team |
| Room to grow | What's in Core | Reminders, reviews, offers, shop, finances, posters and an AI assistant on Pro and Ultra |

Self-hosting costs about $21–22 a month plus your time; Starter is 29 € and nothing to look after.
You can move either way at any time: *More › Move to hosted Statio* in the app, or download everything
from Statio and set it up here.

## Set it up with Claude Code (the easy way)

This repository comes with [Claude Skills](.claude/skills) that do the setup with you:

```bash
git clone https://github.com/aioperants/statio-core.git
cd statio-core
claude
```

Then say: **"Set up my salon"**. Claude walks you through Vercel, the database and email, deploys,
and helps you add your services from your price list (a photo or text works).

## Set it up by hand (about 20 minutes)

1. **Vercel Pro (required)**: import this repository in your Vercel account. A salon taking real bookings is commercial use, which needs Vercel Pro ($20 a month).
2. **Database**: in the Vercel project, *Storage → Neon Postgres*. This sets `DATABASE_URL`.
3. **Environment variables**, your private settings, in Vercel *Settings → Environment Variables* (see [.env.example](.env.example)):
   - `BETTER_AUTH_URL`: your address, e.g. `https://book.yoursalon.com`
   - `BETTER_AUTH_SECRET`: a random string, `openssl rand -base64 32`
   - `OWNER_EMAIL`: your email; signing in with it creates the owner account
   - Email, **required** (sign-in is a link by email, and clients confirm their email to book): `RESEND_API_KEY`, or your own mailbox with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, plus `EMAIL_FROM`.
   - Optional: `GOOGLE_CLIENT_ID/SECRET` and `MICROSOFT_CLIENT_ID/SECRET` for one-tap sign-in, `TURNSTILE_SITE_KEY/SECRET_KEY` for the bot check, `VAPID_PUBLIC_KEY/PRIVATE_KEY` for notifications on the team's phones (`npx web-push generate-vapid-keys`), `EMBED_ALLOWED_ORIGINS` to put the booking page on another website.
4. **Domain**: add your domain in Vercel (*Settings → Domains*), add the DNS records Vercel shows where you bought it, and set `BETTER_AUTH_URL` to `https://yourdomain.com`.
5. **Deploy**. Database migrations run on every deploy.
6. Open `/en/admin`, sign in with the owner email, answer the setup questions, then add services, team and hours.

Already on another website? Put the booking page on it:

```html
<div id="statio-booking"></div>
<script src="https://book.yoursalon.com/embed.js" data-lang="en" async></script>
```

## Add your services from a price list

```bash
npm run services:import -- services.json
```

`services.json` is a list such as `[{ "name": "Haircut", "minutes": 45, "price": 35, "group": "Women" }]`
(`group`, `description` and `rebookDays` are optional). It only adds; nothing is changed or deleted.

## Develop

```bash
nvm use                # Node 22
npm install
cp .env.example .env   # local Postgres in DATABASE_URL
npm run db:migrate
npm run db:seed        # demo salon "Salón Aurora"; owner = OWNER_EMAIL
npm run dev            # http://localhost:3000/en/admin
npm test               # unit tests
npm run lint           # type check
```

Without an email provider, emails (including sign-in links) are printed in the terminal.

## Layout

- `src/lib/slots.ts`: the slot engine (pure, tested)
- `src/lib/booking.ts`: booking, moving, approval rules
- `src/lib/site/`: the website (data, design, sections)
- `src/db/schema.ts`: the database; `drizzle/`: migrations (they only ever add)
- `messages/`: the texts. `en.json` has everything (the app is in English); the other languages
  have only what clients see, and fall back to English for anything missing

## What it tells us

Statio Core says hello to the Statio team once at setup and once a week (Vercel cron): an anonymous
id (a hash of your `BETTER_AUTH_SECRET`), the version, your country and language. That's how we count
installs. Your email and salon name are sent only if you tick *"Email me about updates"* at setup.
Turn it all off with `STATIO_TELEMETRY=off`.

## Who makes it

Statio Core is made by [aioperants](https://aioperants.com): technology consulting and implementation
for small businesses. We help owners get found on Google, win more customers and spend less time on
repetitive work, with websites, local search and AI connected to the tools they already use. Want it
set up for you, or a website designed for your salon? hello@aioperants.com

## License

Apache License 2.0, see [LICENSE](LICENSE). "Statio" is a name of the Statio team; please call your
own copies or forks something else if you offer them to others.
