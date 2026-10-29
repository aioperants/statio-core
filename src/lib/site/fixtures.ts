import { EMPTY_SITE, type SiteData } from "./types";

/**
 * Three salons for the website tests: brand new (nothing filled in), small (one person, a few
 * services) and full (like the demo Salón Aurora). Test data only; never shown to anyone.
 */
const base = { locale: "es", currency: "EUR", bookUrl: "/es/book", brandColor: "#7A2E5A" };

export const emptySalon: SiteData = { ...EMPTY_SITE, ...base, name: "Salón Nuevo" };

export const smallSalon: SiteData = {
  ...EMPTY_SITE,
  ...base,
  name: "Estudio Lucía",
  phone: "+34600111222",
  phoneDisplay: "+34 600 11 12 22",
  address: "Calle Luna 3, Sevilla",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Estudio%20Luc%C3%ADa",
  services: [{ name: null, items: [{ name: "Manicura", durationMin: 45, priceCents: 2000, from: false }, { name: "Pedicura", durationMin: 60, priceCents: 0, from: false }] }],
  team: [{ name: "Lucía", title: null, photo: null, color: "#DCE8FB", bookUrl: "/es/book?staff=lucia" }],
  hours: [{ days: "lun–vie", hours: "10:00–19:00" }],
};

export const fullSalon: SiteData = {
  ...base,
  name: "Salón Aurora",
  logo: null,
  shortAbout: "Peluquería, barbería y uñas en el centro de Madrid.",
  address: "Calle Mayor 12, Madrid",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20Aurora",
  phone: "+34600123456",
  phoneDisplay: "+34 600 12 34 56",
  email: "hola@salonaurora.es",
  links: [{ label: "Instagram", url: "https://www.instagram.com/salon.aurora" }],
  services: [
    { name: "Mujer", items: [{ name: "Corte y peinado", durationMin: 45, priceCents: 3500, from: false }, { id: "bbbbbbbb-0000-4000-8000-000000000001", name: "Mechas", durationMin: 120, priceCents: 8000, from: true }] },
    { name: "Hombre", items: [{ name: "Corte caballero", durationMin: 30, priceCents: 1800, from: false }] },
    { name: "Uñas", items: [{ name: "Manicura semipermanente", durationMin: 60, priceCents: 2800, from: false }] },
  ],
  team: [
    { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Ana", title: "Color y mechas", photo: null, color: "#F9D7E6", bookUrl: "/es/book?staff=ana" },
    { name: "Marta", title: null, photo: null, color: "#DCE8FB", bookUrl: "/es/book?staff=marta" },
    { name: "Javi", title: "Barbero", photo: null, color: "#E3F4E1", bookUrl: "/es/book?staff=javi" },
  ],
  hours: [{ days: "lun–sáb", hours: "09:00–20:00" }],
  closures: [{ when: "Vie, 25 dic", reason: "Navidad" }],
  heroImage: "/api/site/photo?v=abc",
};
