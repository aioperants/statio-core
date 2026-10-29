---
name: statio-services
description: Add a salon's services and prices to Statio Core from a price list (photo, PDF, text or website). Use when the user shares a price list or asks to add, import or set up services.
---

# Add services from a price list

Statio Core imports services from a JSON file with `npm run services:import -- <file>`. It only
adds: existing services and visits are never changed.

## Steps

1. Read the price list the owner gives you (photo, PDF, pasted text or their old website).
2. Build a list, keeping their own words and language for names:

   ```json
   [
     { "name": "Corte y peinado", "minutes": 45, "price": 35, "group": "Mujer" },
     { "name": "Balayage", "minutes": 150, "price": 95, "group": "Mujer", "description": "Mechas a mano alzada, efecto natural.", "rebookDays": 90 }
   ]
   ```

   - `minutes`: if the list has no duration, use a sensible default for the service and say so.
   - `price`: a number in the salon's currency ("from 80" → 80, and mention it to the owner).
   - `group`: the heading on their list (Women, Men, Nails…), optional.
   - `description`: only if the list has one; never invent claims.
   - `rebookDays`: typical days until the client comes back (haircut ~35, colour ~60), optional.
3. Show the owner the list as a short table and ask them to confirm or correct it.
4. Save it to a file (e.g. `services.json`) and run:

   ```bash
   npm run services:import -- services.json
   ```

   The script reads `DATABASE_URL` from `.env`. For a deployed salon, they can copy the Neon
   connection string from Vercel (*Storage*) into `.env` locally; it stays on their computer.
5. Tell them where to check: *Settings › Services* in the admin, and the booking page.

Everyone who takes bookings can do the new services; the owner can change that per person on
the Team screen.
