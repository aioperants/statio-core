import { relations, sql } from "drizzle-orm";

/** Text the salon writes, one per language code: { es: "Corte", en: "Cut" }. */
type Texts = Record<string, string>;
const texts = (name: string) => jsonb(name).$type<Texts>().notNull().default({});
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- Auth (Better Auth tables) ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Better Auth's sign-in limits, kept in the database so every server counts together. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ---------- Salon ---------- */

/** Tries counted per hashed key (lib/limits.ts), so every server counts together. */
export const attemptLimit = pgTable("attempt_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

/**
 * The salon (one per copy): its details, booking rules and settings. The salon's tables carry
 * `business_id`, filled in by the database.
 */
export const business = pgTable("business", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  currency: text("currency").notNull().default("EUR"),
  defaultLocale: text("default_locale").notNull().default("es"),
  /** Languages clients can use on the booking pages; only these are asked for in forms. */
  websiteLocales: text("website_locales").array().notNull().default(sql`'{es,en}'::text[]`),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  /** Logo as a data URL (PNG/JPG/SVG, max ~500 KB), so no extra storage service is needed. */
  logo: text("logo"),
  /** The salon's own colour, used by the website's "brand" palette. */
  brandColor: text("brand_color").notNull().default("#111111"),
  /** The app's own colours (admin, booking page, app icon): "neutral" = black and white, "website" = the website's look. */
  appColours: text("app_colours").notNull().default("neutral"),
  /** How the booking page looks: like the salon's website (fonts, colours, header and menu), or clean black and white. */
  /** The logo as it was uploaded (margins already trimmed), so the owner can adjust it again; `logo` is the adjusted one used everywhere. */
  logoOriginal: text("logo_original"),
  bookingLook: text("booking_look").$type<"site" | "clean">().notNull().default("site"),
  // Booking rules
  slotStepMin: smallint("slot_step_min").notNull().default(15),
  leadMinutes: integer("lead_minutes").notNull().default(120),
  horizonDays: integer("horizon_days").notNull().default(28),
  /** Off = a new client's first booking waits in Requests (the default for new salons). */
  autoApprove: boolean("auto_approve").notNull().default(false),
  noShowApprovalThreshold: smallint("no_show_approval_threshold").notNull().default(2),
  compactDay: boolean("compact_day").notNull().default(false),
  /**
   * How times are offered online: "recommend" puts the times that fill gaps on top (everything stays
   * bookable), "only" offers just those (Compact day), "all" shows every time alike.
   */
  slotMode: text("slot_mode").notNull().default("recommend"),
  /** Where its public holidays come from ("ES" or "ES-MD"), remembered for "Add public holidays". */
  holidayRegion: text("holiday_region"),
  /** The salon's country (ISO code, e.g. "ES"): the default country code for phone numbers. */
  country: text("country"),
  /** Online booking only within online_hours (e.g. open 9–17, bookable online 9–13); off = all open hours. */
  onlineHoursOn: boolean("online_hours_on").notNull().default(false),
  /** Max visits per staff member per day for online booking; null = no limit. */
  dailyLimit: smallint("daily_limit"),
  maxFutureBookingsNewClient: smallint("max_future_bookings_new_client").notNull().default(2),
  cancellationHours: integer("cancellation_hours").notNull().default(24),
  welcomeTexts: texts("welcome_texts"),
  stationsLabels: texts("stations_labels"),
  /** The optional questions new clients see on their first booking, and the "how did you hear" choices. */
  askHeardFrom: boolean("ask_heard_from").notNull().default(true),
  askCity: boolean("ask_city").notNull().default(true),
  heardOptions: text("heard_options").array().notNull().default(sql`'{recommended,social,google,walkby,other}'::text[]`),
  setupDone: boolean("setup_done").notNull().default(false),
  // Being found online: their own website, a short description and their profiles elsewhere.
  website: text("website"),
  about: text("about"),
  /** What kind of business it is (hair, barber, nails, beauty): picked at setup, used for search engines. */
  businessTypes: text("business_types").array().notNull().default(sql`'{}'::text[]`),
  instagram: text("instagram"),
  facebook: text("facebook"),
  tiktok: text("tiktok"),
  /** Other profiles (Booksy, Fresha, Treatwell…): label and link. */
  otherLinks: jsonb("other_links").$type<{ label: string; url: string }[]>().notNull().default([]),
  /** "Get found online" steps the owner has ticked as done, with the day. */
  foundChecklist: jsonb("found_checklist").$type<Record<string, string>>().notNull().default({}),
  /** The address in parts, for maps and search engines; `address` keeps the one-line version shown everywhere. */
  addressStreet: text("address_street"),
  addressPostcode: text("address_postcode"),
  addressTown: text("address_town"),
  /** Show only the town publicly (e.g. working from home), never the street. */
  addressTownOnly: boolean("address_town_only").notNull().default(false),
  /** The square icon (app icon, browser tab, search engines), when the owner made their own; null = made from the logo or initials. */
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The salon a row belongs to: this copy's one salon, filled in by the database (core_business_id(),
 * see drizzle/0000_statio_core.sql), so inserts don't pass it.
 */
const businessId = () =>
  uuid("business_id")
    .notNull()
    .default(sql`core_business_id()`)
    .references(() => business.id, { onDelete: "cascade" });

export const staffRole = pgEnum("staff_role", ["owner", "admin", "staff"]);
export const payModel = pgEnum("pay_model", ["owner", "salary", "commission", "salary_commission", "chair_rent"]);

export const staff = pgTable("staff", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  color: text("color").notNull().default("#DCE8FB"),
  /** Square photo (data URL, shrunk in the browser), shown to clients when they pick a person. */
  photo: text("photo"),
  /** One line under the name, e.g. "Colour and highlights". */
  title: text("title"),
  role: staffRole("role").notNull().default("staff"),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  bookable: boolean("bookable").notNull().default(true),
  payModel: payModel("pay_model").notNull().default("commission"),
  salaryCents: integer("salary_cents"),
  commissionPct: smallint("commission_pct"),
  chairRentCents: integer("chair_rent_cents"),
  /** How often the chair rent is due ("month" or "week") and on which day (1–28, or 0 = Monday … 6). */
  chairRentPeriod: text("chair_rent_period").notNull().default("month"),
  chairRentDay: smallint("chair_rent_day").notNull().default(1),
  defaultChairId: uuid("default_chair_id"),
  /** Clients whose first visit is with this person are theirs (typically a chair renter). */
  ownsClients: boolean("owns_clients").notNull().default(false),
  /** This person's admin language; the admin opens in it on any device. */
  locale: text("locale"),
  sortOrder: smallint("sort_order").notNull().default(0),
  lastName: text("last_name"),
  /** e.g. "Senior stylist" (the `title` above is the speciality clients see). */
  jobTitle: text("job_title"),
  /** For sending their invite by WhatsApp. */
  phone: text("phone"),
  /** What they can do: owner | manager | stylist | frontdesk | renter (see lib/permissions). */
  access: text("access").notNull().default("stylist"),
  /** Exceptions to their access level, per area: { clientData: "edit" }. */
  permissions: jsonb("permissions").$type<Record<string, string>>().notNull().default({}),
  /** Personal invite link: works once, until it expires. */
  inviteToken: text("invite_token").unique(),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
  /** Access paused by the owner: they can't sign in to this salon until it's turned back on. They stay in the calendar. */
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  /** The owner's second email, confirmed: if they lose the first, it moves their sign-in here (see lib/recovery). */
  recoveryEmail: text("recovery_email"),
});

/** Tabs on the booking page (e.g. "Mujer" / "Women"), in the salon's own order. */
export const serviceCategory = pgTable("service_category", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  nameEs: text("name_es").notNull(),
  nameEn: text("name_en"),
  names: texts("names"),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const service = pgTable("service", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  names: texts("names"),
  /** A few words for clients about the service (what it is, what to expect): shown on the website. */
  descriptions: texts("descriptions"),
  /** Group shown as a tab on the booking page, e.g. "Mujer" / "Women". */
  category: text("category"),
  categoryEn: text("category_en"),
  /** The category picked from the list; `category`/`categoryEn` keep a copy of its names. */
  categoryNames: texts("category_names"),
  categoryId: uuid("category_id").references(() => serviceCategory.id, { onDelete: "set null" }),
  durationMin: smallint("duration_min").notNull(),
  bufferBeforeMin: smallint("buffer_before_min").notNull().default(0),
  bufferAfterMin: smallint("buffer_after_min").notNull().default(0),
  priceCents: integer("price_cents").notNull(),
  /** Kind of shared station this service needs (e.g. "pedicure"), or null. */
  stationKind: text("station_kind"),
  /** Typical days until the client should come back (e.g. 35 for a haircut); drives "time to book again". */
  rebookDays: smallint("rebook_days"),
  /** Keep a colour card (the formula) for visits with this service. */
  colourCard: boolean("colour_card").notNull().default(false),
  /** Clients confirm a patch test / allergy check when booking it (colour, lashes, perms…). */
  needsConsent: boolean("needs_consent").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
});

/**
 * Who owns what: tools (scissors, dryers…) and equipment (a pedicure chair, a steamer…), belonging
 * to the salon or to one person. Salon equipment can be rented, with its monthly cost kept for the
 * money side. It doesn't affect booking.
 */
export const equipment = pgTable("equipment", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("tool"),
  /** Null = the salon's. */
  ownerStaffId: uuid("owner_staff_id").references(() => staff.id, { onDelete: "set null" }),
  /** Where it's kept, e.g. "Station 2" or "Storage box 3". */
  location: text("location"),
  note: text("note"),
  photo: text("photo"),
  rented: boolean("rented").notNull().default(false),
  monthlyCostCents: integer("monthly_cost_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffService = pgTable(
  "staff_service",
  {
    businessId: businessId(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "cascade" }),
    durationMin: smallint("duration_min"),
    priceCents: integer("price_cents"),
    commissionPct: smallint("commission_pct"),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

/** Chairs, basins, nail desks, pedicure chairs, rooms. */
export const chair = pgTable("chair", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("styling"),
  shared: boolean("shared").notNull().default(false),
  rentCents: integer("rent_cents"),
  renterStaffId: uuid("renter_staff_id").references(() => staff.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
});

/** Weekly pattern. weekday: 0 = Monday … 6 = Sunday. Minutes from local midnight. */
export const workingHours = pgTable(
  "working_hours",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMin: smallint("start_min").notNull(),
    endMin: smallint("end_min").notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
  },
  (t) => [index("working_hours_staff_idx").on(t.staffId, t.weekday)],
);

/** Time off for one person, or a salon closure when staffId is null. */
/**
 * When the salon is open (several rows per weekday for a split day; none = closed that day).
 * No rows at all = not set up, so only each person's working hours count.
 */
export const businessHours = pgTable("business_hours", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  weekday: smallint("weekday").notNull(),
  startMin: smallint("start_min").notNull(),
  endMin: smallint("end_min").notNull(),
});

/**
 * When clients can book online, used only while business.onlineHoursOn is set (several rows per
 * weekday for a split day; none = no online booking that day). Bookings made by the salon ignore it.
 */
export const onlineHours = pgTable("online_hours", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  weekday: smallint("weekday").notNull(),
  startMin: smallint("start_min").notNull(),
  endMin: smallint("end_min").notNull(),
});

export const timeOff = pgTable(
  "time_off",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    /** Closed to online booking only; the owner can still add bookings by hand. */
    onlineOnly: boolean("online_only").notNull().default(false),
  },
  (t) => [index("time_off_range_idx").on(t.startsAt, t.endsAt)],
);

export const clientStatus = pgEnum("client_status", ["active", "needs_approval", "blocked"]);
export const clientSource = pgEnum("client_source", ["online", "import", "admin", "whatsapp"]);

export const client = pgTable(
  "client",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Set when their first visit was with someone who owns their clients; the owner still sees everyone. */
    ownerStaffId: uuid("owner_staff_id").references(() => staff.id, { onDelete: "set null" }),
    notes: text("notes"),
    /** "MM-DD" (the year is often unknown and not needed for a greeting). */
    birthday: text("birthday"),
    /** Set by hand: this client comes every N days, whatever the services or history say. */
    rhythmDays: smallint("rhythm_days"),
    /** The one shared record behind "guest" visits (tourists, one-off walk-ins): never listed or contacted. */
    guest: boolean("guest").notNull().default(false),
    /** Personal data erased on request (GDPR); the visits stay, without a name. */
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    /** Optional answers from their first booking: how they found the salon (an option key or the salon's own words), who recommended them, where they live. */
    heardFrom: text("heard_from"),
    recommendedBy: text("recommended_by"),
    city: text("city"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    locale: text("locale"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    noShowCount: smallint("no_show_count").notNull().default(0),
    status: clientStatus("status").notNull().default("active"),
    source: clientSource("source").notNull().default("online"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_email_idx").on(t.businessId, sql`lower(${t.email})`),
    index("client_phone_idx").on(t.phone),
    index("client_user_idx").on(t.userId),
  ],
);

/** Dated notes on a client, newest first: colour formulas, what was done, what they liked. */
export const clientNote = pgTable(
  "client_note",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_note_client_idx").on(t.clientId, t.createdAt)],
);

export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "declined",
  "no_show",
]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "other"]);
export const appointmentSource = pgEnum("appointment_source", ["web", "admin", "whatsapp"]);

export const appointment = pgTable(
  "appointment",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** startsAt/endsAt widened by buffers; the double-booking constraint uses these. */
    occupiedFrom: timestamp("occupied_from", { withTimezone: true }).notNull(),
    occupiedTo: timestamp("occupied_to", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("confirmed"),
    source: appointmentSource("source").notNull().default("web"),
    /** Booked online at one of the recommended times. */
    suggested: boolean("suggested").notNull().default(false),
    bookedForName: text("booked_for_name"),
    notes: text("notes"),
    priceCents: integer("price_cents").notNull().default(0),
    manageToken: text("manage_token").notNull(),
    /** Booked on purpose over another visit or outside hours (walk-ins, favourites). */
    allowOverlap: boolean("allow_overlap").notNull().default(false),
    // Checkout
    paidCents: integer("paid_cents"),
    paymentMethod: paymentMethod("payment_method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Days until the next visit, set at checkout; null = use the service default. 0 = no reminder. */
    rebookDays: smallint("rebook_days"),
    /** Colour card: the formula used at this visit (brand, shade, developer, time), to repeat it next time. */
    formula: text("formula"),
    /** When the client confirmed the patch test / allergy check for services that need it. */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    /** The owner messaged the client that their person can't come. */
    absenceNotifiedAt: timestamp("absence_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointment_staff_time_idx").on(t.staffId, t.startsAt),
    index("appointment_client_idx").on(t.clientId),
    uniqueIndex("appointment_token_idx").on(t.manageToken),
  ],
);

/** One row per service in a visit. A station (pedicure chair, basin) is reserved per line. */
export const appointmentLine = pgTable(
  "appointment_line",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointment.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    priceCents: integer("price_cents").notNull(),
    chairId: uuid("chair_id").references(() => chair.id, { onDelete: "set null" }),
    /** Mirrors the visit's status (false once cancelled/declined) for the station constraint. */
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("appointment_line_appt_idx").on(t.appointmentId)],
);

/** Audit of sensitive admin actions. */
export const auditLog = pgTable("audit_log", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: text("user_id"),
  action: text("action").notNull(),
  detail: text("detail"),
});

/** Every email (later SMS/WhatsApp) sent. */
export const messageLog = pgTable("message_log", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointment.id, { onDelete: "set null" }),
  /** The client it was for (emails, and WhatsApp/SMS messages opened from the app). */
  clientId: uuid("client_id").references(() => client.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("email"),
  template: text("template").notNull(),
  to: text("to").notNull(),
  status: text("status").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Relations (for db.query ... with) ---------- */

export const appointmentRelations = relations(appointment, ({ one, many }) => ({
  client: one(client, { fields: [appointment.clientId], references: [client.id] }),
  staff: one(staff, { fields: [appointment.staffId], references: [staff.id] }),
  lines: many(appointmentLine),
}));

export const appointmentLineRelations = relations(appointmentLine, ({ one }) => ({
  appointment: one(appointment, { fields: [appointmentLine.appointmentId], references: [appointment.id] }),
  service: one(service, { fields: [appointmentLine.serviceId], references: [service.id] }),
  chair: one(chair, { fields: [appointmentLine.chairId], references: [chair.id] }),
}));

export const clientRelations = relations(client, ({ many }) => ({
  appointments: many(appointment),
  notesLog: many(clientNote),
}));

export const clientNoteRelations = relations(clientNote, ({ one }) => ({
  client: one(client, { fields: [clientNote.clientId], references: [client.id] }),
  staff: one(staff, { fields: [clientNote.staffId], references: [staff.id] }),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  appointments: many(appointment),
  services: many(staffService),
  hours: many(workingHours),
}));

export const staffServiceRelations = relations(staffService, ({ one }) => ({
  staff: one(staff, { fields: [staffService.staffId], references: [staff.id] }),
  service: one(service, { fields: [staffService.serviceId], references: [service.id] }),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  staff: one(staff, { fields: [workingHours.staffId], references: [staff.id] }),
}));

/** How the salon sends email, set in Settings › Email (one row per salon). Secrets are encrypted (lib/secret-box). */
export const mailSettings = pgTable("mail_settings", {
  businessId: businessId().primaryKey(),
  /** "resend", "smtp" or "none"; no row = use the server's environment variables. */
  provider: text("provider").notNull(),
  fromAddress: text("from_address"),
  resendKeyEnc: text("resend_key_enc"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassEnc: text("smtp_pass_enc"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The salon's own website (Settings › Website): which sections are on, and the owner's own texts.
 * Everything else on it (services, prices, team, hours, contact) is read live from the app. `draft` is what the owner edits and previews; `published`
 * is what clients see, once the website is switched on. Shape: lib/site/config.ts.
 */
export const website = pgTable("website", {
  businessId: businessId().primaryKey(),
  /** Shown at the salon's address; off = the address opens the booking page, as before. */
  enabled: boolean("enabled").notNull().default(false),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull(),
  published: jsonb("published").$type<Record<string, unknown>>(),
  /** The big photo at the top (data URL, shrunk in the browser), as edited and as published. */
  heroDraft: text("hero_draft"),
  heroPublished: text("hero_published"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Photos for the website's "Our work" gallery (shrunk in the browser, kept as data URLs). Which ones show, in
 * what order and with what caption, is in the website's draft and published settings.
 */
export const websitePhoto = pgTable("website_photo", {
  businessId: businessId(),
  id: uuid("id").primaryKey().defaultRandom(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A phone or computer that gets this person's notifications (web push), one row per device. */
export const pushDevice = pgTable(
  "push_device",
  {
    businessId: businessId(),
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Salon days the morning and end-of-day notes went out, so an extra cron run never sends twice. */
    morningOn: date("morning_on"),
    eveningOn: date("evening_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_device_endpoint_idx").on(t.businessId, t.endpoint)],
);
