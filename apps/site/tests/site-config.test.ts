import { describe, expect, it } from "vitest";
import { readSite } from "../src/content/site";

describe("readSite (contacts come from NEXT_PUBLIC_* variables)", () => {
  it("leaves a contact undefined when its variable is missing or empty (never an empty string)", () => {
    const site = readSite({ NEXT_PUBLIC_WHATSAPP_URL: "", NEXT_PUBLIC_CONTACT_EMAIL: undefined });
    expect(site.whatsappUrl).toBeUndefined();
    expect(site.email).toBeUndefined();
    expect(site.instagram).toBeUndefined();
    expect(site.linkedin).toBeUndefined();
  });

  it("reads each contact from its variable", () => {
    const site = readSite({
      NEXT_PUBLIC_WHATSAPP_URL: "https://wa.me/5500000000000",
      NEXT_PUBLIC_CONTACT_EMAIL: "oi@dynamo.business",
      NEXT_PUBLIC_INSTAGRAM_URL: "https://instagram.com/dynamo",
      NEXT_PUBLIC_LINKEDIN_URL: "https://linkedin.com/company/dynamo",
    });
    expect(site).toEqual({
      whatsappUrl: "https://wa.me/5500000000000",
      email: "oi@dynamo.business",
      instagram: "https://instagram.com/dynamo",
      linkedin: "https://linkedin.com/company/dynamo",
    });
  });

  it("trims whitespace", () => {
    expect(readSite({ NEXT_PUBLIC_WHATSAPP_URL: "  https://wa.me/1  " }).whatsappUrl).toBe("https://wa.me/1");
  });
});
