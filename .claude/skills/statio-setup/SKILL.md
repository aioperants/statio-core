---
name: statio-setup
description: Set up and deploy Statio Core for a salon (Vercel, Neon Postgres, email, domain, first sign-in). Use when the user says "set up my salon", "deploy Statio", "install Statio Core" or asks how to get the website and booking online.
---

# Set up Statio Core for a salon

Goal: the salon's website and online booking live on their own Vercel account and domain, with
the owner signed in. Talk to the owner in plain words, one step at a time; most owners are not
technical. Never ask them to paste secrets into the chat: they type keys into Vercel or `.env`
themselves.

## 1. Ask first (one message)

- Salon name, town, and the owner's email (becomes `OWNER_EMAIL`).
- Do they have a domain (e.g. `yoursalon.com`)? If not, suggest buying one in Vercel (*Domains*).
- Which email to send from: their own mailbox (SMTP) or Resend (free tier is enough).

## 2. Run it locally first (optional, 5 minutes)

```bash
npm install
cp .env.example .env            # then set DATABASE_URL to a local Postgres
npm run db:migrate
npm run dev                     # http://localhost:3000/en/admin
```

Without email set, sign-in links appear in the terminal.

## 3. Deploy on Vercel

Use the Vercel CLI if it's installed (`npx vercel`), otherwise guide them in the dashboard:

1. Import this repository (their fork) as a new project.
2. *Storage → Create → Neon Postgres*, connected to the project: this sets `DATABASE_URL`.
3. *Settings → Environment Variables*:
   - `BETTER_AUTH_URL` = `https://<their domain or booking subdomain>`
   - `BETTER_AUTH_SECRET` = output of `openssl rand -base64 32` (generate it for them)
   - `OWNER_EMAIL` = the owner's email
   - Email: `RESEND_API_KEY` + `EMAIL_FROM`, or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` + `EMAIL_FROM`
   - Optional: `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` (Cloudflare, free) against bots
4. *Settings → Domains*: add the domain; follow the DNS records Vercel shows.
5. Deploy. Migrations run automatically (`vercel-build`).

Vercel Pro is required ($20 a month): a salon taking real bookings is commercial use, which needs Vercel Pro. Say so plainly before they start.

## 4. First sign-in

Open `https://<domain>/en/admin` (the admin is in English), sign in with the owner email, answer the setup
questions (name, type of salon, address, hours). Then continue with the `statio-services` skill
to add services from their price list.

## 5. Check before you finish

- `https://<domain>/api/health` answers `ok`.
- The booking page `https://<domain>/en/book` shows their services.
- A test booking arrives as an email (or in the Vercel logs when email isn't set yet).
- Publish the website: *Settings › Your website › Publish*.

Report what's done and what's left (e.g. "DNS can take a few hours").
