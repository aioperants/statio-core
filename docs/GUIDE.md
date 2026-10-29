# How to set up and use Statio Core

A step-by-step guide for salon owners. No coding needed. Plan about 30 minutes for the setup and
another 30 to add your services, team and hours.

Statio Core gives one salon, barber, nail studio or spa:

- a **website** with your services, prices, team, photos, hours and map,
- **online booking** that only offers free times, with email confirmations,
- a **client book** (CRM) with history, notes and who is due back,
- a **daily screen** for the team: today's visits, walk-ins, blocked time and takings.

**Want to see it first?** Start a free 14-day trial of the hosted version at
[statiocrm.com](https://statiocrm.com), no card needed. It's the same app.

Everything runs on your own accounts, so you own the data. Prefer not to run it yourself?
[Statio](https://statiocrm.com) hosts it for you.

---

## 1. What you need

| | Why | Cost |
| --- | --- | --- |
| A **GitHub** account | Holds your copy of Statio Core | Free |
| **Vercel Pro** (required) | Runs your website and booking | **$20 a month.** A salon taking real bookings is commercial use, which needs Vercel Pro |
| A **domain**, e.g. `yoursalon.com` | Your address on the web | Around 10–20 € a year. You can buy one inside Vercel |
| An **email sender** (required) | Sign-in links, and clients confirming their email to book | Free: [Resend](https://resend.com) (free plan), or your own mailbox |

The database (Neon Postgres) is created from inside Vercel and has a free plan.

## 2. The easy way: let Claude do it

If you use [Claude Code](https://claude.com/claude-code), it knows how to set up Statio Core for you:

```bash
git clone https://github.com/aioperants/statio-core.git
cd statio-core
claude
```

Say **"Set up my salon"**. Claude asks a few questions, guides you through Vercel, the database and
email, and checks that everything works. Then send it a photo of your price list and say **"Add my
services"**.

Claude never needs your passwords or keys in the chat: you type those into Vercel yourself.

If you'd rather click through it yourself, follow the steps below.

## 3. Set it up by hand

### Step 1: Make your own copy

1. Sign in to GitHub and open the Statio Core repository.
2. Click **Fork** (top right), then **Create fork**. You now have your own copy.

### Step 2: Put it on Vercel

1. Sign in to [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New › Project**, find your `statio-core` copy and click **Import**.
3. Don't click Deploy yet. Open **Environment Variables** and add the ones in Step 4 first
   (you can also add them later and redeploy).

### Step 3: Create the database

1. In your Vercel project, open **Storage › Create Database › Neon (Postgres)**.
2. Pick the region closest to your salon and connect it to the project.

That's it: Vercel adds the database address (`DATABASE_URL`) for you.

### Step 4: Fill in your settings

These are your private settings (passwords and keys). They live in Vercel, never in the app or the
code, so nobody who sees your website can read them. In the project, open **Settings › Environment
Variables**, and for each one type the **Key** (the name), paste the **Value**, and click **Save**:

| Name | What to put |
| --- | --- |
| `BETTER_AUTH_URL` | Your address, e.g. `https://book.yoursalon.com` (or `https://yoursalon.com`) |
| `BETTER_AUTH_SECRET` | A long random password. On a Mac, open Terminal and run `openssl rand -base64 32`, then copy the result |
| `OWNER_EMAIL` | Your own email. Signing in with it makes you the owner |
| `EMAIL_FROM` | Who emails come from, e.g. `Salon Aurora <bookings@yoursalon.com>` |

Then email, which is **required**: sign-in is a link by email, and clients confirm their email with a
link before they book. Without it nobody can sign in and nobody can book online. Pick **one**:

- **Resend (easiest, free):** create an account at resend.com, add your domain under *Domains*
  (it shows two or three DNS records to add where you bought the domain), then create a key under
  *API Keys* and add it as `RESEND_API_KEY`. `EMAIL_FROM` must use that domain.
- **Your own mailbox:** `SMTP_HOST`, `SMTP_PORT` (usually `587`), `SMTP_USER`, `SMTP_PASS`.
  Your email provider's help pages list these.

Once you're in, **Settings › Bookings › More options › Client emails** can change it and send you a test.

Optional extras (all free):

- **Bot check** on the booking page: `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from Cloudflare Turnstile.
- **"Sign in with Google / Microsoft"**: `GOOGLE_CLIENT_ID`/`SECRET`, `MICROSOFT_CLIENT_ID`/`SECRET`.
- **Notifications on the team's phones**: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
  (run `npx web-push generate-vapid-keys` to make them).

### Step 5: Deploy

Click **Deploy** (or **Deployments › Redeploy** if you added settings later). It takes 2–3 minutes.
The database is prepared automatically on every deploy.

### Step 6: Connect your domain

1. In Vercel: **Settings › Domains › Add**, type your domain.
2. Vercel shows one or two DNS records. Add them where you bought the domain (if you bought it in
   Vercel, this is already done).
3. It can take from a few minutes to a few hours to start working.

### Step 7: Check it works

Open these in your browser (with your own address):

- `https://yoursalon.com/api/health` shows **ok**.
- `https://yoursalon.com/en/admin` shows the sign-in page.

## 4. Your first day in the app

1. Open `https://yoursalon.com/en/admin` and enter your owner email. The app is in English; what
   clients see (booking page, website, emails) can be in English, Spanish, German, French, Italian,
   Portuguese or Ukrainian: **Settings › Business › Language for clients**.
   You get a sign-in link by email. No password to remember.
2. Answer the short setup questions: salon name, type, address and opening hours.
3. Follow **Getting started** in the menu. It shows what is left. **Settings** has six parts:
   - **Business**: name, logo, contact, opening hours and closed days (public holidays in one tap).
   - **Team**: add each person, what they do and their access to the app (they sign in with
     their own email), and under **Shifts** who works when (split shifts are fine).
   - **Services**: what clients can book, how long it takes and the price.
     Have a long price list? Use Claude (see section 2) or the import in section 7.
     Rarely needed extras (clean-up time, shared chairs and rooms, patch test) are under
     **More options** on each service.
   - **Bookings**: approve a new client's first booking yourself, or accept all automatically,
     and until when clients can cancel online. Everything else is under **More options**.
   - **Website**: your website, its address, and your booking link with its QR code.
   - **Get found**: your Google profile and other search engines.
   Everything works without changing anything here: change only what you want.
4. Make a test booking yourself on `https://yoursalon.com/en/book` and check the email arrives.

### Turn on your website

Until you publish it, your address opens the booking page. To get the full website:

1. **Settings › Website › Edit my website**: add photos, choose sections and write your About text.
2. Click **Publish**.

### Share your booking link

- **Settings › Website** shows your booking link and a **QR code** to download and print for the front desk.
- Put the link in your Instagram bio, WhatsApp Business and Google profile
  (**Settings › Get found** walks you through it).
- Already have a website? Put the booking on it with these two lines:

  ```html
  <div id="statio-booking"></div>
  <script src="https://yoursalon.com/embed.js" data-lang="en" async></script>
  ```

  and add that website's address to `EMBED_ALLOWED_ORIGINS` in Vercel.

### Use it like an app

On a phone or tablet, open your admin address and choose **Add to Home Screen**
(Safari: Share button; Chrome: menu). It then opens full screen, like an app.

## 5. Every day

- **Today**: who's coming, who's next, free gaps and today's takings.
- **New booking** for phone calls, **Walk-in** for someone at the door,
  **Block time** for breaks, **Someone is off** for a sick day.
- **Close a visit** in two taps: the amount and how they paid. This is an internal record, not an invoice.
- **Requests**: bookings waiting for your approval (if you turned approvals on).
- **Calendar**: the week, per person.
- **Clients**: search, notes, allergies, birthdays, history, no-shows, and who is **due back**,
  with a WhatsApp message in one tap.

## 6. Your data

- Download everything at any time: **Download data** in the menu under your name (bottom left; on a phone, **More › My account**).
- Bringing clients from another system? **Clients › Import** reads a CSV from your contacts,
  Excel, Booksy or Fresha.
- The database is yours, in your own Neon account.

## 7. Add many services at once (optional)

Make a file `services.json` like this:

```json
[
  { "name": "Haircut", "minutes": 45, "price": 35, "group": "Women" },
  { "name": "Beard trim", "minutes": 20, "price": 15, "group": "Men", "rebookDays": 21 }
]
```

Then, on your computer, inside your copy of Statio Core, with your database address
(from Vercel › Storage) in a file called `.env`:

```bash
npm install
npm run services:import -- services.json
```

It only adds services. Nothing you already have is changed or deleted.

## 8. Getting updates

When Statio Core gets new features, open **your copy** on GitHub and click **Sync fork › Update branch**.
Vercel redeploys on its own within a few minutes. Your data is untouched: database changes only
ever add, never remove.

## 9. If something isn't working

| Problem | What to check |
| --- | --- |
| The sign-in email doesn't arrive | Spam folder. Then the email settings in Vercel (or **Settings › Bookings › More options › Client emails**, which has a test button). Without email set up, the link is printed in Vercel's **Logs** |
| "Not the owner" or no access | `OWNER_EMAIL` in Vercel must match the email you type exactly. Redeploy after changing it |
| The domain shows an error | DNS can take a few hours. Vercel › Settings › Domains shows when it's ready |
| The deploy failed | Vercel › Deployments › the failed one › **Logs**. Usually a missing `DATABASE_URL` (step 3) |
| The booking page shows no times | Check **Team › Shifts** (someone must be working that day), opening hours under **Business**, and that the service is given to a person under **Team** |
| Lost access to your email | Use **Owner and lost access to your email?** on the sign-in page |

## 10. Running it on your own computer (for developers)

```bash
nvm use                # Node 22
npm install
cp .env.example .env   # set DATABASE_URL to a local Postgres
npm run db:migrate
npm run db:seed        # a demo salon, "Salón Aurora"
npm run dev            # http://localhost:3000/en/admin
```

No Postgres installed? With Docker:

```bash
docker run -d --name statio-core-db -e POSTGRES_PASSWORD=core -e POSTGRES_DB=statio -p 5432:5432 postgres:16-alpine
```

and use `DATABASE_URL=postgres://postgres:core@localhost:5432/statio`.

Sign-in links are printed in the terminal while email isn't set up.
