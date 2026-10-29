import { describe, expect, it } from "vitest";
import { allows, exceptionsFrom, grantable, permissionsOf } from "./permissions";

describe("permissions", () => {
  it("gives the owner everything, whatever is stored", () => {
    expect(allows({ access: "owner", permissions: { clientData: "none" } }, "clientData", "full")).toBe(true);
  });
  it("keeps the front desk from deleting or exporting, and from takings", () => {
    const desk = { access: "frontdesk" };
    expect(allows(desk, "clients", "edit")).toBe(true);
    expect(allows(desk, "clients", "full")).toBe(false);
    expect(allows(desk, "clientData", "view")).toBe(false);
    expect(allows(desk, "money", "view")).toBe(false);
    expect(allows(desk, "calendar", "edit")).toBe(true);
  });
  it("applies a person's exceptions on top of their level", () => {
    expect(allows({ access: "frontdesk", permissions: { clientData: "edit" } }, "clientData", "edit")).toBe(true);
    expect(permissionsOf({ access: "stylist", permissions: { nonsense: "full", money: "weird" } }).money).toBe("none");
  });
  it("lets managers do the day to day, but not export clients by default", () => {
    expect(allows({ access: "manager" }, "settings", "full")).toBe(true);
    expect(allows({ access: "manager" }, "clientData", "view")).toBe(false);
  });
  it("stores only real exceptions", () => {
    expect(exceptionsFrom("stylist", { clients: "view", money: "view" })).toEqual({ money: "view" });
  });
  it("lets only the owner hand out manager access", () => {
    expect(grantable({ access: "manager" }, "manager")).toBe(false);
    expect(grantable({ access: "manager" }, "frontdesk")).toBe(true);
    expect(grantable({ access: "owner" }, "manager")).toBe(true);
  });
});
