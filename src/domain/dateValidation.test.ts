import { describe, expect, it } from "vitest";

import { datePartsError, joinDate, normalizeDateParts, splitDate } from "./dateValidation";

describe("date validation", () => {
  it("strips non-numeric input before joining dates", () => {
    expect(normalizeDateParts({ day: "0a7", month: "1b2", year: "19xx45" })).toEqual({
      day: "07",
      month: "12",
      year: "1945",
    });
    expect(joinDate({ day: "", month: "", year: "abc" })).toBeUndefined();
  });

  it("joins partial and full dates into canonical strings", () => {
    expect(joinDate({ day: "", month: "", year: "1945" })).toBe("1945");
    expect(joinDate({ day: "", month: "5", year: "1945" })).toBe("1945-05");
    expect(joinDate({ day: "7", month: "5", year: "1945" })).toBe("1945-05-07");
  });

  it("reports incomplete or out-of-range dates", () => {
    expect(datePartsError({ day: "", month: "5", year: "" })).toBe("Укажите год.");
    expect(datePartsError({ day: "7", month: "", year: "1945" })).toBe("Укажите месяц.");
    expect(datePartsError({ day: "", month: "13", year: "1945" })).toBe("Проверьте месяц.");
    expect(datePartsError({ day: "32", month: "1", year: "1945" })).toBe("Проверьте день.");
  });

  it("splits existing stored dates into editable parts", () => {
    expect(splitDate("~1945-05-07")).toEqual({ day: "07", month: "05", year: "1945" });
  });
});
