/**
 * Demo data for trying the app locally: npm run db:seed
 * Refuses to run on a database that already has a salon.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../src/db";
import { addDays, localToUtc, todayIn, weekdayOf } from "../src/lib/time";

async function main() {
  if (await db.query.business.findFirst({ columns: { id: true } })) {
    console.log("This database already has a salon; not seeding.");
    process.exit(0);
  }
  await seedSalon();
  console.log("Seeded Salón Aurora with 4 people, 4 categories, 11 services, 6 stations, 8 clients, 11 visits and equipment.");
  process.exit(0);
}

async function seedSalon() {
  const tz = "Europe/Madrid";
  const today = todayIn(tz);
  await db.insert(schema.business).values({
    id: randomUUID(),
    name: "Salón Aurora",
    timezone: tz,
    phone: "+34 600 123 456",
    address: "Calle Mayor 12, Madrid",
    businessTypes: ["hair", "barber", "nails"],
    about: "Peluquería, barbería y uñas en el centro de Madrid.",
    instagram: "https://www.instagram.com/salonaurora",
    email: process.env.OWNER_EMAIL ?? "owner@example.com",
    // Clients get Spanish; each team member picks their own admin language.
    websiteLocales: ["es"],
    welcomeTexts: { es: "¡Hola {name}! Te damos la bienvenida a {salon}. Si tienes cualquier duda antes de tu cita, escríbenos por aquí." },
    // The demo confirms bookings straight away (new salons approve new clients first).
    autoApprove: true,
    setupDone: true,
  });

  const [ana, marta, lena] = await db
    .insert(schema.staff)
    .values([
      { name: "Ana", email: (process.env.OWNER_EMAIL ?? "owner@example.com").toLowerCase(), role: "owner", access: "owner", payModel: "owner", locale: "es", color: "#F6D9E6", sortOrder: 0 },
      { name: "Marta", lastName: "Sanz", jobTitle: "Estilista", email: "marta@example.com", locale: "en", role: "staff", access: "stylist", payModel: "commission", commissionPct: 40, color: "#DCE8FB", sortOrder: 1 },
      // Rents the nail desk and keeps her own clients.
      { name: "Lena", lastName: "Vogel", email: "lena@example.com", role: "staff", access: "renter", payModel: "chair_rent", chairRentCents: 45000, ownsClients: true, color: "#DDF3E4", sortOrder: 2 },
    ])
    .returning();

  const categories = await db
    .insert(schema.serviceCategory)
    .values([
      { nameEs: "Mujer", nameEn: "Women", sortOrder: 1 },
      { nameEs: "Hombre", nameEn: "Men", sortOrder: 2 },
      { nameEs: "Uñas", nameEn: "Nails", sortOrder: 3 },
      { nameEs: "Tratamientos", nameEn: "Treatments", sortOrder: 4 },
    ])
    .returning();
  const services = await db
    .insert(schema.service)
    .values([
      { nameEs: "Corte y peinado", nameEn: "Cut & style", category: "Mujer", categoryEn: "Women", durationMin: 45, priceCents: 3500, rebookDays: 35, sortOrder: 1 },
      { nameEs: "Corte caballero", nameEn: "Men's cut", category: "Hombre", categoryEn: "Men", durationMin: 30, priceCents: 1800, rebookDays: 28, sortOrder: 2 },
      { nameEs: "Color raíz", nameEn: "Root colour", category: "Mujer", categoryEn: "Women", durationMin: 90, bufferAfterMin: 10, priceCents: 5500, stationKind: "basin", rebookDays: 42, sortOrder: 3 },
      { nameEs: "Manicura semipermanente", nameEn: "Gel manicure", category: "Uñas", categoryEn: "Nails", durationMin: 60, priceCents: 2800, rebookDays: 21, sortOrder: 4 },
      { nameEs: "Pedicura spa", nameEn: "Spa pedicure", category: "Uñas", categoryEn: "Nails", durationMin: 60, bufferAfterMin: 10, priceCents: 3500, stationKind: "pedicure", sortOrder: 5 },
      { nameEs: "Brushing", nameEn: "Blow-dry", category: "Mujer", categoryEn: "Women", durationMin: 30, priceCents: 2000, rebookDays: 7, sortOrder: 6 },
      { nameEs: "Mechas", nameEn: "Highlights", category: "Mujer", categoryEn: "Women", durationMin: 120, bufferAfterMin: 10, priceCents: 8000, stationKind: "basin", rebookDays: 70, sortOrder: 7 },
      { nameEs: "Arreglo de barba", nameEn: "Beard trim", category: "Hombre", categoryEn: "Men", durationMin: 20, priceCents: 1200, rebookDays: 21, sortOrder: 8 },
      { nameEs: "Corte y barba", nameEn: "Cut & beard", category: "Hombre", categoryEn: "Men", durationMin: 45, priceCents: 2800, rebookDays: 28, sortOrder: 9 },
      { nameEs: "Manicura clásica", nameEn: "Classic manicure", category: "Uñas", categoryEn: "Nails", durationMin: 40, priceCents: 1800, rebookDays: 14, sortOrder: 10 },
      // Needs the salon's own station type (see the chairs below).
      { nameEs: "Masaje craneal", nameEn: "Head massage", category: "Tratamientos", categoryEn: "Treatments", durationMin: 30, priceCents: 2500, stationKind: "Camilla de masaje", sortOrder: 11 },
    ])
    .returning();
  const [cut, mens, colour, mani, pedi, blow, highlights, beard, cutBeard, classicMani, massage] = services;
  for (const c of categories) await db.update(schema.service).set({ categoryId: c.id }).where(eq(schema.service.category, c.nameEs));
  // Salon texts are written once, in the language for clients (Spanish here).
  await db.execute(sql`update service set names = jsonb_build_object('es', name_es), category_names = jsonb_strip_nulls(jsonb_build_object('es', category))`);
  await db.execute(sql`update service_category set names = jsonb_build_object('es', name_es)`);

  const chairs = await db
    .insert(schema.chair)
    .values([
      { name: "Sillón 1", kind: "styling", sortOrder: 1 },
      { name: "Sillón 2", kind: "styling", sortOrder: 2 },
      { name: "Lavacabezas", kind: "basin", shared: true, sortOrder: 3 },
      { name: "Mesa de uñas", kind: "nail", renterStaffId: lena.id, rentCents: 45000, sortOrder: 4 },
      { name: "Sillón pedicura", kind: "pedicure", shared: true, sortOrder: 5 },
      { name: "Camilla", kind: "Camilla de masaje", shared: true, sortOrder: 6 },
    ])
    .returning();

  await db.insert(schema.staffService).values([
    ...[cut, mens, colour, blow, highlights, beard, cutBeard, massage].flatMap((s) => [ana, marta].map((p) => ({ staffId: p.id, serviceId: s.id }))),
    ...[mani, pedi, classicMani].map((s) => ({ staffId: lena.id, serviceId: s.id })),
  ]);

  const h = (x: number) => x * 60;
  // The salon: Mon–Fri 9:00–20:00, Saturday 10:00–15:00, closed on Sunday.
  await db.insert(schema.businessHours).values([
    ...[0, 1, 2, 3, 4].map((wd) => ({ weekday: wd, startMin: h(9), endMin: h(20) })),
    { weekday: 5, startMin: h(10), endMin: h(15) },
  ]);
  // Closed for a local holiday in three weeks.
  const holiday = addDays(today, 21);
  await db.insert(schema.timeOff).values({ staffId: null, startsAt: localToUtc(holiday, 0, tz), endsAt: localToUtc(addDays(holiday, 1), 0, tz), reason: "Fiesta local" });
  await db.insert(schema.workingHours).values([
    // Ana: Tue–Sat, split shift
    ...[1, 2, 3, 4].flatMap((wd) => [
      { staffId: ana.id, weekday: wd, startMin: h(10), endMin: h(14) },
      { staffId: ana.id, weekday: wd, startMin: h(16), endMin: h(20) },
    ]),
    { staffId: ana.id, weekday: 5, startMin: h(10), endMin: h(15) },
    // Marta: part-time mornings Mon–Fri
    ...[0, 1, 2, 3, 4].map((wd) => ({ staffId: marta.id, weekday: wd, startMin: h(9), endMin: h(14) })),
    // Lena: Mon–Sat afternoons
    ...[0, 1, 2, 3, 4, 5].map((wd) => ({ staffId: lena.id, weekday: wd, startMin: h(12), endMin: h(20) })),
  ]);
  await db.update(schema.staff).set({ defaultChairId: chairs[3].id }).where(eq(schema.staff.id, lena.id));

  const clients = await db
    .insert(schema.client)
    .values([
      { name: "Lucía Pérez", email: "lucia@example.com", phone: "+34 611 222 333", notes: "Color 6.3 + 20 vol", tags: ["VIP", "color"], source: "import" },
      { name: "Carmen Ruiz", email: "carmen@example.com", phone: "+34 622 333 444", source: "import" },
      { name: "Sofía García", email: "sofia@example.com", phone: "+34 633 444 555", noShowCount: 2, source: "online", heardFrom: "social", city: "Valencia" },
      { name: "Javier López", phone: "+34 644 555 666", source: "admin", heardFrom: "walkby", city: "Valencia" },
      { name: "Elena Martín", email: "elena@example.com", phone: "+34 655 666 777", source: "online", heardFrom: "recommended", recommendedBy: "Lucía", city: "Madrid" },
      { name: "Marina Gómez", email: "marina@example.com", phone: "666 777 888", source: "import" },
      { name: "Sofía Navarro", email: "sofia.n@example.com", phone: "655 444 222", source: "import" },
      { name: "Pablo Ortega", phone: "677 888 111", source: "import" },
    ])
    .returning();

  const visit = async (o: { day: string; start: number; who: typeof ana; services: (typeof cut)[]; client: (typeof clients)[0]; status?: "confirmed" | "pending" | "completed"; chair?: string }) => {
    const total = o.services.reduce((a, s) => a + s.durationMin, 0);
    const buffer = o.services[o.services.length - 1].bufferAfterMin;
    const at = (m: number) => localToUtc(o.day, m, tz);
    const [a] = await db
      .insert(schema.appointment)
      .values({
        clientId: o.client.id,
        staffId: o.who.id,
        startsAt: at(o.start),
        endsAt: at(o.start + total),
        occupiedFrom: at(o.start),
        occupiedTo: at(o.start + total + buffer),
        status: o.status ?? "confirmed",
        source: "web",
        priceCents: o.services.reduce((x, s) => x + s.priceCents, 0),
        manageToken: randomBytes(24).toString("base64url"),
      })
      .returning();
    let t = o.start;
    for (const s of o.services) {
      await db.insert(schema.appointmentLine).values({
        appointmentId: a.id,
        serviceId: s.id,
        startsAt: at(t),
        endsAt: at(t + s.durationMin),
        priceCents: s.priceCents,
        chairId: s.stationKind ? chairs.find((c) => c.kind === s.stationKind)!.id : null,
      });
      t += s.durationMin;
    }
  };

  // Next open day (the salon is closed on Sundays).
  const tomorrow = weekdayOf(addDays(today, 1)) === 6 ? addDays(today, 2) : addDays(today, 1);
  await visit({ day: today, start: h(10), who: marta, services: [colour, cut], client: clients[0] });
  await visit({ day: today, start: h(12) + 30, who: marta, services: [mens], client: clients[3] });
  await visit({ day: today, start: h(13), who: lena, services: [mani], client: clients[1] });
  await visit({ day: today, start: h(17), who: lena, services: [pedi], client: clients[4] });
  await visit({ day: tomorrow, start: h(11), who: ana, services: [cut], client: clients[1] });
  await visit({ day: tomorrow, start: h(16), who: lena, services: [mani], client: clients[2], status: "pending" });
  await visit({ day: addDays(today, -7), start: h(10), who: marta, services: [cut], client: clients[0], status: "completed" });
  await visit({ day: addDays(today, -14), start: h(13), who: lena, services: [mani], client: clients[4], status: "completed" });
  // Due to come back: last haircut 40 days ago, nothing booked since.
  await visit({ day: addDays(today, -40), start: h(10), who: marta, services: [cut], client: clients[5], status: "completed" });
  // Next visit coming up this week (cut every 35 days, men's cut every 28) - owner can invite them early.
  await visit({ day: addDays(today, -31), start: h(11), who: marta, services: [cut], client: clients[6], status: "completed" });
  await visit({ day: addDays(today, -24), start: h(17), who: marta, services: [mens], client: clients[7], status: "completed" });

  // A receptionist with a pending invite, and one exception: she may download the client list.
  await db.insert(schema.staff).values({
    name: "Paula",
    lastName: "Ruiz",
    jobTitle: "Recepción",
    email: "paula@example.com",
    phone: "+34 600 555 444",
    role: "staff",
    access: "frontdesk",
    permissions: { clientData: "view" },
    bookable: false,
    payModel: "salary",
    salaryCents: 140000,
    color: "#E9E0FA",
    sortOrder: 3,
    inviteToken: "demo-invite-paula-0000000000",
    inviteExpiresAt: new Date(Date.now() + 7 * 86_400_000),
  });

  // Birthdays (one this week, so the 🎂 filter shows something) and a few dated notes.
  await db.update(schema.client).set({ birthday: addDays(today, 3).slice(5) }).where(eq(schema.client.id, clients[0].id));
  await db.update(schema.client).set({ birthday: "03-14" }).where(eq(schema.client.id, clients[4].id));
  await db.insert(schema.clientNote).values([
    { clientId: clients[0].id, staffId: marta.id, text: "Color 6.3 + 20 vol, 35 min. Muy contenta con el resultado.", createdAt: localToUtc(addDays(today, -7), h(11), tz) },
    { clientId: clients[0].id, staffId: ana.id, text: "Prefiere citas por la mañana.", createdAt: localToUtc(addDays(today, -40), h(10), tz) },
    { clientId: clients[4].id, staffId: lena.id, text: "Semipermanente rojo cereza. Uñas finas: lima suave.", createdAt: localToUtc(addDays(today, -14), h(14), tz) },
  ]);

  // Lena's own clients: their first visit was with her.
  await db.update(schema.client).set({ ownerStaffId: lena.id }).where(eq(schema.client.id, clients[4].id));

  // Who owns what.
  await db.insert(schema.equipment).values([
    { name: "Sillón de pedicura eléctrico", kind: "equipment", location: "Cabina", rented: true, monthlyCostCents: 6000 },
    { name: "Vaporizador de color", kind: "equipment", location: "Lavacabezas" },
    { name: "Secador Dyson", kind: "tool", location: "Sillón 1" },
    { name: "Kit de limas y alicates", kind: "tool", ownerStaffId: lena.id, location: "Caja 3" },
    { name: "Tijeras Jaguar 5.5\"", kind: "tool", ownerStaffId: marta.id, location: "Sillón 2", note: "Afiladas en septiembre" },
  ]);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
