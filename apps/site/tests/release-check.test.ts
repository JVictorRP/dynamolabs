import { describe, expect, it } from "vitest";
import { checkRelease } from "../scripts/lib/check-release";

const READY_ENV = {
  NEXT_PUBLIC_LEAD_ENDPOINT: "https://app.dynamo.business/api/public/lead",
  NEXT_PUBLIC_WHATSAPP_URL: "https://wa.me/5527999990000",
};

describe("checkRelease (the launch is blocked until these are settled)", () => {
  it("lists what is missing: provisional copy, no lead endpoint and no WhatsApp link", () => {
    const problems = checkRelease({}, "provisional");
    expect(problems.length).toBeGreaterThanOrEqual(3);
    expect(problems.join("\n")).toMatch(/copy/i);
    expect(problems.join("\n")).toMatch(/NEXT_PUBLIC_LEAD_ENDPOINT/);
    expect(problems.join("\n")).toMatch(/NEXT_PUBLIC_WHATSAPP_URL/);
  });

  it("returns no problems when the copy is final and both variables are set", () => {
    expect(checkRelease(READY_ENV, "final")).toEqual([]);
  });

  it("treats empty or whitespace-only variables as missing", () => {
    const problems = checkRelease({ NEXT_PUBLIC_LEAD_ENDPOINT: "   ", NEXT_PUBLIC_WHATSAPP_URL: "" }, "final");
    expect(problems).toHaveLength(2);
  });

  it("requires https for the lead endpoint (the form sends personal data)", () => {
    const problems = checkRelease({ ...READY_ENV, NEXT_PUBLIC_LEAD_ENDPOINT: "http://app.dynamo.business/api/public/lead" }, "final");
    expect(problems.join("\n")).toMatch(/https/i);
  });

  it("also blocks provisional legal pages", () => {
    const problems = checkRelease(READY_ENV, "final", "provisional");
    expect(problems.join("\n")).toMatch(/privacidade|termos|legal/i);
  });
});
