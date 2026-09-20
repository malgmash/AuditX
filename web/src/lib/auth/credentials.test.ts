import { describe, expect, it } from "vitest";
import { parseCredentials } from "./credentials";

describe("parseCredentials", () => {
  it("trims and lowercases the email", () => {
    expect(
      parseCredentials({ email: "  JohnsonAMeyaw24@Gmail.com  ", password: "a-password" }),
    ).toEqual({ email: "johnsonameyaw24@gmail.com", password: "a-password" });
  });

  it("rejects a blank or overlong password", () => {
    expect(parseCredentials({ email: "a@b.com", password: "" })).toBeNull();
    expect(parseCredentials({ email: "a@b.com", password: "x".repeat(201) })).toBeNull();
  });

  it("reads the first value when Auth.js passes arrays", () => {
    expect(parseCredentials({ email: ["a@b.com"], password: ["secret-pass"] })).toEqual({
      email: "a@b.com",
      password: "secret-pass",
    });
  });
});
