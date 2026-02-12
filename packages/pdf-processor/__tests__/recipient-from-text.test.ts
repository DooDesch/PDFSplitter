/**
 * Unit tests for parseRecipientFromText and buildSafeFilename.
 */
import { describe, it, expect } from "vitest";
import {
  parseRecipientFromText,
  buildSafeFilename,
  type Recipient,
} from "../src/recipient-from-text.js";

describe("parseRecipientFromText", () => {
  it("returns null for empty or whitespace-only text", () => {
    expect(parseRecipientFromText("")).toBeNull();
    expect(parseRecipientFromText("   \n  ")).toBeNull();
  });

  it("parses 'Name: Vorname Nachname'", () => {
    const r = parseRecipientFromText("Name: Max Mustermann");
    expect(r).toEqual({ vorname: "Max", nachname: "Mustermann", wohnort: "" });
  });

  it("parses 'Rechnungsempfänger: Nachname, Vorname'", () => {
    const r = parseRecipientFromText("Rechnungsempfänger: Mustermann, Max");
    expect(r).toEqual({ vorname: "Max", nachname: "Mustermann", wohnort: "" });
  });

  it("parses PLZ and Ort from line like '12345 Berlin'", () => {
    const r = parseRecipientFromText(
      "Name: Max Mustermann\n12345 Berlin"
    );
    expect(r?.wohnort).toBe("12345 Berlin");
  });

  it("returns null when no name or ort pattern found", () => {
    expect(parseRecipientFromText("Random text without name or address")).toBeNull();
  });
});

describe("buildSafeFilename", () => {
  it("returns Seite_NN.pdf when recipient is null", () => {
    expect(buildSafeFilename(null, 0)).toBe("Seite_01.pdf");
    expect(buildSafeFilename(null, 9)).toBe("Seite_10.pdf");
  });

  it("returns Nachname_Vorname_Wohnort.pdf when recipient is set", () => {
    const r: Recipient = { vorname: "Max", nachname: "Mustermann", wohnort: "12345 Berlin" };
    expect(buildSafeFilename(r, 0)).toBe("Mustermann_Max_12345_Berlin.pdf");
  });

  it("sanitizes unsafe characters", () => {
    const r: Recipient = { vorname: "Max", nachname: "Mustermann", wohnort: "Berlin (West)" };
    const name = buildSafeFilename(r, 0);
    expect(name).toMatch(/\.pdf$/);
    expect(name).not.toContain("(");
    expect(name).not.toContain(")");
  });
});
