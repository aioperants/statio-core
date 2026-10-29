import { describe, expect, it } from "vitest";
import { staffFromSlug, staffSlugs } from "./staff-link";

describe("staff booking links", () => {
  const people = [
    { id: "1", name: "Marta", lastName: "Ruiz" },
    { id: "2", name: "Lucía", lastName: "Pérez" },
    { id: "3", name: "Lucía", lastName: "Gómez" },
    { id: "4", name: "Ana", lastName: null },
  ];
  it("uses the first name, and the full name when two people share it", () => {
    const s = staffSlugs(people);
    expect(s.get("1")).toBe("marta");
    expect(s.get("2")).toBe("lucia-perez");
    expect(s.get("3")).toBe("lucia-gomez");
    expect(s.get("4")).toBe("ana");
  });
  it("finds the person from the link", () => {
    expect(staffFromSlug(people, "Marta")?.id).toBe("1");
    expect(staffFromSlug(people, "lucia-gomez")?.id).toBe("3");
    expect(staffFromSlug(people, "3")?.id).toBe("3");
    expect(staffFromSlug(people, "nobody")).toBeNull();
  });
});
