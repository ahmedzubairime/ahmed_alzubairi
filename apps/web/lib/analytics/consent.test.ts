// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONSENT_EVENT, CONSENT_KEY, readConsent, writeConsent } from "./consent";

afterEach(() => localStorage.clear());

describe("consent", () => {
  it("is null before any choice, and for an unknown value", () => {
    expect(readConsent()).toBeNull();
    localStorage.setItem(CONSENT_KEY, "maybe");
    expect(readConsent()).toBeNull();
  });

  it("saves the choice under `consent` and tells the provider", () => {
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, (event) => heard((event as CustomEvent).detail));
    writeConsent("denied");
    expect(localStorage.getItem("consent")).toBe("denied");
    expect(readConsent()).toBe("denied");
    expect(heard).toHaveBeenCalledWith("denied");
  });

  it("survives blocked storage: no choice read, the event still fires", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readConsent(blocked)).toBeNull();
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, heard);
    expect(() => writeConsent("granted", blocked)).not.toThrow();
    expect(heard).toHaveBeenCalled();
  });
});
