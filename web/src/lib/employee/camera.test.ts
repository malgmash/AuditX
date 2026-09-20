import { describe, expect, it } from "vitest";
import { cameraUnavailableReason } from "./camera";

describe("cameraUnavailableReason", () => {
  it("explains a blocked permission", () => {
    expect(cameraUnavailableReason(new DOMException("denied", "NotAllowedError"))).toMatch(
      /blocked the camera/i,
    );
  });

  it("explains a missing camera", () => {
    expect(cameraUnavailableReason(new DOMException("missing", "NotFoundError"))).toMatch(
      /no camera/i,
    );
  });
});
