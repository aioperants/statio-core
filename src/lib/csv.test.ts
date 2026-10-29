import { describe, expect, it } from "vitest";
import { clientsFromCsv, parseCsv } from "./csv";

describe("csv import", () => {
  it("reads quoted cells with commas and quotes", () => {
    expect(parseCsv('a,b\n"Smith, Ann","say ""hi"""\n')).toEqual([["a", "b"], ["Smith, Ann", 'say "hi"']]);
  });

  it("detects semicolons from Spanish Excel", () => {
    const c = clientsFromCsv("Nombre;Teléfono;Correo\nLucía Pérez;600 111 222;LUCIA@mail.es\n");
    expect(c).toEqual([{ name: "Lucía Pérez", phone: "600 111 222", email: "lucia@mail.es", notes: null }]);
  });

  it("joins first and last name and drops bad emails", () => {
    const c = clientsFromCsv("First Name,Last Name,E-mail 1 - Value,Phone 1 - Value\nAnn,Lee,not-an-email,+34 600\n,,,\n");
    expect(c).toEqual([{ name: "Ann Lee", email: null, phone: "+34 600", notes: null }]);
  });
});
