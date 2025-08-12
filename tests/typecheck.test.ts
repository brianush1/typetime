import { t } from "../src";

describe("String literals", () => {
  const type = t.literal("hi");

  it("should pass checks", () => {
    expect(type.check("hi")).toBeTruthy();
  });

  it("should fail checks", () => {
    expect(type.check("bye")).toBeFalsy();
    expect(type.check(0)).toBeFalsy();
    expect(type.check(null)).toBeFalsy();
    expect(type.check(undefined)).toBeFalsy();
  });

  it("should sanitize", () => {
    expect(type.sanitize("hi").value).toStrictEqual("hi");
  });
});

describe("Objects", () => {
  const type = t.object({
    x: t.number,
    y: t.enum("hi", "bye", 2, 3),
    h: t.optional(t.string),
  });

  it("should pass checks", () => {
    expect(
      type.check({
        x: 2,
        y: 3,
        h: "asd",
      })
    ).toBeTruthy();
    expect(
      type.check({
        x: 2,
        y: 3,
      })
    ).toBeTruthy();
  });

  it("should fail checks", () => {
    expect(
      type.check({
        x: 2,
        y: 3,
        h: null,
      })
    ).toBeFalsy();
    expect(
      type.check({
        x: 2,
        y: "by",
        h: "fg",
      })
    ).toBeFalsy();
    expect(type.check({})).toBeFalsy();
    expect(type.check("bye")).toBeFalsy();
    expect(type.check(0)).toBeFalsy();
    expect(type.check(null)).toBeFalsy();
    expect(type.check(undefined)).toBeFalsy();
  });

  it("should sanitize", () => {
    const obj = {
      x: 2,
      y: "bye" as const,
      z: 3,
    };
    const extra: t.TypeOf<typeof type> = obj;
    expect(extra).toStrictEqual({
      x: 2,
      y: "bye",
      z: 3,
    });
    expect(type.sanitize(extra).value).toStrictEqual({
      x: 2,
      y: "bye",
    });
    expect(
      type.sanitize({
        x: 2,
        y: "bye",
        h: "asd",
      }).value
    ).toStrictEqual({
      x: 2,
      y: "bye",
      h: "asd",
    });
  });
});

describe("Union types", () => {
  const type = t.or(
    t.literal("hi"),
    t.object({
      x: t.number,
      y: t.string,
    }),
    t.object({
      z: t.string,
    })
  );

  it("should pass checks", () => {
    expect(type.check("hi")).toBeTruthy();
    expect(
      type.check({
        x: 2,
        y: "asd",
      })
    ).toBeTruthy();
    expect(
      type.check({
        z: "asd",
      })
    ).toBeTruthy();
    expect(
      type.check({
        x: 2,
        y: "asd",
        z: "def",
      })
    ).toBeTruthy();
  });

  it("should fail checks", () => {
    expect(type.check("hia")).toBeFalsy();
    expect(type.check(null)).toBeFalsy();
    expect(type.check(undefined)).toBeFalsy();
    expect(
      type.check({
        x: "2",
        y: "asd",
      })
    ).toBeFalsy();
    expect(
      type.check({
        x: 2,
      })
    ).toBeFalsy();
  });

  it("should sanitize", () => {
    expect(type.sanitize("hi").value).toStrictEqual("hi");
    expect(
      type.sanitize({
        x: 6,
        y: "fhf",
        z: 4,
      } as t.TypeOf<typeof type>).value
    ).toStrictEqual({
      x: 6,
      y: "fhf",
    });
    expect(
      type.sanitize({
        x: 6,
        y: "fhf",
        z: "g",
      } as t.TypeOf<typeof type>).value
    ).toStrictEqual({
      x: 6,
      y: "fhf",
      z: "g",
    });
  });
});

describe("Intersection types", () => {
  const type = t.and(
    t.object({
      z: t.or(t.string, t.number),
    }),
    t.object({
      x: t.number,
      y: t.string,
    })
  );

  it("should pass checks", () => {
    expect(
      type.check({
        z: "asd",
        x: 2,
        y: "hf",
      })
    ).toBeTruthy();
    expect(
      type.check({
        z: 7,
        y: "hf",
        x: 5,
      })
    ).toBeTruthy();
    expect(
      type.check({
        z: 7,
        y: "hf",
        x: 5,
        g: 78,
      })
    ).toBeTruthy();
  });

  it("should fail checks", () => {
    expect(type.check("hia")).toBeFalsy();
    expect(type.check(null)).toBeFalsy();
    expect(type.check(undefined)).toBeFalsy();
    expect(
      type.check({
        x: "2",
        y: "asd",
      })
    ).toBeFalsy();
    expect(
      type.check({
        x: 2,
      })
    ).toBeFalsy();
    expect(
      type.check({
        x: 2,
        y: "asd",
        z: false,
      })
    ).toBeFalsy();
  });

  it("should sanitize", () => {
    expect(
      type.sanitize({
        x: 2,
        y: "asd",
        z: 755,
      }).value
    ).toStrictEqual({
      x: 2,
      y: "asd",
      z: 755,
    });
    expect(
      type.sanitize({
        x: 6,
        y: "fhf",
        z: 4,
        g: 7,
      } as t.TypeOf<typeof type>).value
    ).toStrictEqual({
      x: 6,
      y: "fhf",
      z: 4,
    });
  });
});

describe("Refinements", () => {
  it("should work on strings", () => {
    const type = t.string.refine((v) => !!v.match(/^[a-z]+$/));
    expect(type.check("a")).toBeTruthy();
    expect(type.check("agsfsdf")).toBeTruthy();
    expect(type.check("agsfs df")).toBeFalsy();
    expect(type.check("")).toBeFalsy();
    expect(type.check("ASDA")).toBeFalsy();
    expect(type.check(46)).toBeFalsy();
  });
  it("should work on objects", () => {
    const type = t
      .object({
        x: t.string,
        y: t.string,
        length: t.number,
      })
      .refine((v) => v.length === 1)
      .refine((v) => v.x !== "y");
    expect(
      type.check({
        x: "asd",
        y: "def",
        length: 1,
      })
    ).toBeTruthy();
    expect(
      type.check({
        x: "asd",
        y: "def",
        length: 2,
      })
    ).toBeFalsy();
    expect(
      type.check({
        x: "y",
        y: "def",
        length: 1,
      })
    ).toBeFalsy();
    expect(type.check("a")).toBeFalsy();
    expect(type.check("agsfsdf")).toBeFalsy();
    expect(type.check("agsfs df")).toBeFalsy();
    expect(type.check("")).toBeFalsy();
    expect(type.check("ASDA")).toBeFalsy();
    expect(type.check(46)).toBeFalsy();
  });
});
