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

describe("Tuple types", () => {
  describe("Basic tuple functionality", () => {
    const stringNumberTuple = t.tuple(t.string, t.number);

    it("should pass type checks with correct values", () => {
      expect(stringNumberTuple.check(["hello", 42])).toBe(true);
      expect(stringNumberTuple.check(["", 0])).toBe(true);
      expect(stringNumberTuple.check(["test", -5])).toBe(true);
    });

    it("should fail type checks with incorrect values", () => {
      expect(stringNumberTuple.check([42, "hello"])).toBe(false); // swapped types
      expect(stringNumberTuple.check(["hello"])).toBe(false); // too few elements
      expect(stringNumberTuple.check(["hello", 42, "extra"])).toBe(false); // too many elements
      expect(stringNumberTuple.check("not-array")).toBe(false); // not an array
      expect(stringNumberTuple.check(null)).toBe(false);
      expect(stringNumberTuple.check(undefined)).toBe(false);
    });

    it("should sanitize correctly", () => {
      const result = stringNumberTuple.sanitize(["hello", 42]);
      expect(result.value).toEqual(["hello", 42]);
      expect(result.__sanitized).toBe(true);
    });

    it("should generate correct type strings", () => {
      expect(stringNumberTuple.toTypeString()).toBe("[string, number]");

      const complexTuple = t.tuple(
        t.string,
        t.object({ id: t.number }),
        t.array(t.boolean)
      );
      expect(complexTuple.toTypeString()).toBe(
        "[string, { id: number; }, boolean[]]"
      );
    });
  });

  describe("Empty and single element tuples", () => {
    const emptyTuple = t.tuple();
    const singleTuple = t.tuple(t.string);

    it("should handle empty tuples", () => {
      expect(emptyTuple.check([])).toBe(true);
      expect(emptyTuple.check([1])).toBe(false); // wrong length
      expect(emptyTuple.sanitize([]).value).toEqual([]);
      expect(emptyTuple.toTypeString()).toBe("[]");
    });

    it("should handle single element tuples", () => {
      expect(singleTuple.check(["hello"])).toBe(true);
      expect(singleTuple.check([])).toBe(false); // wrong length
      expect(singleTuple.check(["hello", "world"])).toBe(false); // wrong length
      expect(singleTuple.sanitize(["test"]).value).toEqual(["test"]);
      expect(singleTuple.toTypeString()).toBe("[string]");
    });
  });

  describe("Mixed primitive and complex types", () => {
    const mixedTuple = t.tuple(
      t.string,
      t.number,
      t.object({ name: t.string }),
      t.array(t.number),
      t.boolean
    );

    it("should validate mixed types correctly", () => {
      const validValue = ["hello", 42, { name: "test" }, [1, 2, 3], true];
      expect(mixedTuple.check(validValue)).toBe(true);
    });

    it("should fail with invalid mixed types", () => {
      expect(
        mixedTuple.check([
          42, // wrong type
          42,
          { name: "test" },
          [1, 2, 3],
          true,
        ])
      ).toBe(false);

      expect(
        mixedTuple.check([
          "hello",
          42,
          { name: 123 }, // wrong nested type
          [1, 2, 3],
          true,
        ])
      ).toBe(false);
    });

    it("should sanitize mixed types correctly", () => {
      const input: t.TypeOf<typeof mixedTuple> = [
        "hello",
        42,
        { name: "test", extra: "removed" } as any, // extra property should be removed
        [1, 2, 3],
        true,
      ];
      const result = mixedTuple.sanitize(input);
      expect(result.value).toEqual([
        "hello",
        42,
        { name: "test" }, // extra property removed
        [1, 2, 3],
        true,
      ]);
    });
  });

  describe("Nested tuples", () => {
    const nestedTuple = t.tuple(
      t.string,
      t.tuple(t.number, t.boolean),
      t.array(t.tuple(t.string, t.number))
    );

    it("should validate nested tuples", () => {
      const validValue = [
        "outer",
        [42, true],
        [
          ["a", 1],
          ["b", 2],
        ],
      ];
      expect(nestedTuple.check(validValue)).toBe(true);
    });

    it("should fail with invalid nested tuples", () => {
      expect(
        nestedTuple.check([
          "outer",
          [42], // missing boolean
          [
            ["a", 1],
            ["b", 2],
          ],
        ])
      ).toBe(false);

      expect(
        nestedTuple.check([
          "outer",
          [42, true],
          [
            ["a", 1],
            ["b", "not-number"],
          ], // wrong type in nested tuple
        ])
      ).toBe(false);
    });

    it("should sanitize nested tuples", () => {
      const input: t.TypeOf<typeof nestedTuple> = [
        "outer",
        [42, true],
        [
          ["a", 1],
          ["b", 2],
        ],
      ];
      const result = nestedTuple.sanitize(input);
      expect(result.value).toEqual(input);
    });

    it("should generate correct type strings for nested tuples", () => {
      expect(nestedTuple.toTypeString()).toBe(
        "[string, [number, boolean], [string, number][]]"
      );
    });
  });

  describe("Tuples in objects and arrays", () => {
    const objectWithTuple = t.object({
      coordinates: t.tuple(t.number, t.number),
      name: t.string,
    });

    const arrayOfTuples = t.array(t.tuple(t.string, t.number));

    it("should validate tuples in objects", () => {
      expect(
        objectWithTuple.check({
          coordinates: [10, 20],
          name: "point",
        })
      ).toBe(true);

      expect(
        objectWithTuple.check({
          coordinates: [10], // missing y coordinate
          name: "point",
        })
      ).toBe(false);
    });

    it("should validate arrays of tuples", () => {
      expect(
        arrayOfTuples.check([
          ["a", 1],
          ["b", 2],
          ["c", 3],
        ])
      ).toBe(true);

      expect(
        arrayOfTuples.check([
          ["a", 1],
          ["b"], // missing number
          ["c", 3],
        ])
      ).toBe(false);
    });

    it("should sanitize tuples in complex structures", () => {
      const objectResult = objectWithTuple.sanitize({
        coordinates: [10, 20],
        name: "point",
        extra: "removed",
      } as any);
      expect(objectResult.value).toEqual({
        coordinates: [10, 20],
        name: "point",
      });

      const arrayResult = arrayOfTuples.sanitize([
        ["a", 1],
        ["b", 2],
      ]);
      expect(arrayResult.value).toEqual([
        ["a", 1],
        ["b", 2],
      ]);
    });
  });

  describe("Tuple error handling and field paths", () => {
    const complexTuple = t.tuple(
      t.string,
      t.object({ id: t.number }),
      t.array(t.string)
    );

    it("should provide correct field paths for tuple errors", () => {
      const result = t.parse(complexTuple, [
        123, // wrong type at index 0
        { id: "not-number" }, // wrong nested type at index 1.id
        ["valid", 456], // wrong type at index 2.1
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(3);

        // Error at tuple index 0
        expect(result.errors[0].field).toEqual([0]);
        expect(result.errors[0].message).toBe("expected string");

        // Error at tuple index 1, nested field id
        expect(result.errors[1].field).toEqual([1, "id"]);
        expect(result.errors[1].message).toBe("expected number");

        // Error at tuple index 2, array index 1
        expect(result.errors[2].field).toEqual([2, 1]);
        expect(result.errors[2].message).toBe("expected string");
      }
    });

    it("should handle array length correctly", () => {
      const schema = t.tuple(t.string, t.number);

      // Too few elements should fail
      const tooFewResult = t.parse(schema, ["hello"]);
      expect(tooFewResult.success).toBe(false);
      if (!tooFewResult.success) {
        expect(tooFewResult.errors[0].message).toBe(
          "expected array of length 2"
        );
      }

      // Too many elements should fail
      const tooManyResult = t.parse(schema, ["hello", 42, "extra"]);
      expect(tooManyResult.success).toBe(false);
      if (!tooManyResult.success) {
        expect(tooManyResult.errors[0].message).toBe(
          "expected array of length 2"
        );
      }
    });
  });

  describe("Tuples with refinements", () => {
    const refinedTuple = t.tuple(
      t.string.refine((s) => s.length > 0, "String cannot be empty"),
      t.number.refine((n) => n > 0, "Number must be positive")
    );

    it("should validate refined tuple elements", () => {
      expect(refinedTuple.check(["hello", 42])).toBe(true);
      expect(refinedTuple.check(["", 42])).toBe(false); // empty string fails refinement
      expect(refinedTuple.check(["hello", -1])).toBe(false); // negative number fails refinement
    });

    it("should provide refinement error messages", () => {
      const result = t.parse(refinedTuple, ["", -5]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].message).toBe("String cannot be empty");
        expect(result.errors[1].message).toBe("Number must be positive");
      }
    });

    it("should sanitize refined tuples", () => {
      const result = refinedTuple.sanitize(["hello", 42]);
      expect(result.value).toEqual(["hello", 42]);
    });
  });

  describe("TypeScript type inference", () => {
    it("should infer correct tuple types", () => {
      const schema = t.tuple(t.string, t.number, t.boolean);

      // TypeScript should infer the type as [string, number, boolean]
      const v = ["hello", 42, true] as unknown;
      if (schema.check(v)) {
        // At compile time, TypeScript knows this is [string, number, boolean]
        let str: string, num: number, bool: boolean;
        [str, num, bool] = v; // This assignment should be type-safe
        expect(typeof str).toBe("string");
        expect(typeof num).toBe("number");
        expect(typeof bool).toBe("boolean");
      }
    });

    it("should work with t.TypeOf for type extraction", () => {
      const schema = t.tuple(t.string, t.object({ id: t.number }));
      type TupleType = t.TypeOf<typeof schema>;

      // This should be typed as [string, { id: number }]
      const validValue: TupleType = ["test", { id: 123 }];
      expect(schema.check(validValue)).toBe(true);
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

  describe("refinement error handling", () => {
    it("should provide default error messages for failed refinements", () => {
      const schema = t.string.refine((v) => v.length > 3);
      const result = t.parse(schema, "hi");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe("invalid value");
        expect(result.errors[0].field).toEqual([]);
      }
    });

    it("should support custom string error messages", () => {
      const schema = t.string.refine(
        (v) => v.length > 3,
        "string must be longer than 3 characters"
      );
      const result = t.parse(schema, "hi");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe(
          "string must be longer than 3 characters"
        );
        expect(result.errors[0].field).toEqual([]);
      }
    });

    it("should support custom function error messages", () => {
      const schema = t.string.refine(
        (v) => v.length > 3,
        (v) => `"${v}" is too short (${v.length} chars, need > 3)`
      );
      const result = t.parse(schema, "hi");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe(
          '"hi" is too short (2 chars, need > 3)'
        );
        expect(result.errors[0].field).toEqual([]);
      }
    });

    it("should handle refinement errors in nested objects", () => {
      const schema = t.object({
        user: t.object({
          email: t.string.refine(
            (v) => v.includes("@"),
            "must be a valid email"
          ),
          age: t.number.refine(
            (v) => v >= 18,
            (v) => `age ${v} is too young, must be 18+`
          ),
        }),
      });

      const result = t.parse(schema, {
        user: {
          email: "invalid-email",
          age: 16,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);

        const emailError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["user", "email"])
        );
        expect(emailError).toBeDefined();
        expect(emailError?.message).toBe("must be a valid email");

        const ageError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["user", "age"])
        );
        expect(ageError).toBeDefined();
        expect(ageError?.message).toBe("age 16 is too young, must be 18+");
      }
    });

    it("should handle multiple refinements on the same type", () => {
      const schema = t.string
        .refine((v) => v.length >= 3, "too short")
        .refine((v) => v.length <= 10, "too long")
        .refine((v) => /^[a-zA-Z]+$/.test(v), "must contain only letters");

      // Test with input that fails first refinement
      const result1 = t.parse(schema, "ab");
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.errors.length).toBe(1);
        expect(result1.errors[0].message).toBe("too short");
      }

      // Test with input that fails a later refinement
      const result2 = t.parse(schema, "ab1");
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.errors.length).toBe(1);
        // Refinements fail fast - stops at first failed refinement
        expect(result2.errors[0].message).toBe("must contain only letters");
      }

      // Test with input that passes all refinements
      const result3 = t.parse(schema, "hello");
      expect(result3.success).toBe(true);
    });

    it("should handle refinement errors in arrays", () => {
      const schema = t.array(
        t.object({
          score: t.number.refine(
            (v) => v >= 0 && v <= 100,
            "score must be between 0 and 100"
          ),
        })
      );

      const result = t.parse(schema, [
        { score: 85 },
        { score: 150 }, // invalid
        { score: 90 },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual([1, "score"]);
        expect(result.errors[0].message).toBe(
          "score must be between 0 and 100"
        );
      }
    });

    it("should handle base type failure before refinement", () => {
      const schema = t.string.refine((v) => v.length > 3, "too short");
      const result = t.parse(schema, 123);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        // Should get base type error, not refinement error
        expect(result.errors[0].message).toBe("expected string");
      }
    });

    it("should handle refinements in union types", () => {
      const schema = t.or(
        t.string.refine((v) => v.length > 5, "string too short"),
        t.number.refine((v) => v > 100, "number too small")
      );

      const result = t.parse(schema, "hi");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        // Should get the union error message, not individual refinement errors
        expect(result.errors[0].message).toContain("expected");
      }
    });

    it("should handle refinements in intersection types", () => {
      const schema = t.and(
        t.object({ x: t.number }),
        t.object({ x: t.number.refine((v) => v > 0, "x must be positive") })
      );

      const result = t.parse(schema, { x: -5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual(["x"]);
        expect(result.errors[0].message).toBe("x must be positive");
      }
    });

    it("should preserve field paths through refinements", () => {
      const schema = t.object({
        nested: t.object({
          deep: t.object({
            value: t.string.refine(
              (v) => v !== "forbidden",
              "this value is not allowed"
            ),
          }),
        }),
      });

      const result = t.parse(schema, {
        nested: {
          deep: {
            value: "forbidden",
          },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual(["nested", "deep", "value"]);
        expect(result.errors[0].message).toBe("this value is not allowed");
      }
    });
  });
});

describe("toTypeString", () => {
  it("should generate correct strings for primitive types", () => {
    expect(t.string.toTypeString()).toBe("string");
    expect(t.number.toTypeString()).toBe("number");
    expect(t.boolean.toTypeString()).toBe("boolean");
    expect(t.null.toTypeString()).toBe("null");
    expect(t.undefined.toTypeString()).toBe("undefined");
  });

  it("should generate correct strings for literal types", () => {
    expect(t.literal("hello").toTypeString()).toBe('"hello"');
    expect(t.literal(42).toTypeString()).toBe("42");
    expect(t.literal(true).toTypeString()).toBe("true");
  });

  it("should generate correct strings for enum types", () => {
    const enumType = t.enum("red", "green", "blue", 42);
    expect(enumType.toTypeString()).toBe('"red" | "green" | "blue" | 42');
  });

  it("should generate correct strings for array types", () => {
    expect(t.array(t.string).toTypeString()).toBe("string[]");
    expect(t.array(t.number).toTypeString()).toBe("number[]");
  });

  it("should generate correct strings for object types", () => {
    const objType = t.object({
      name: t.string,
      age: t.number,
      active: t.optional(t.boolean),
    });
    expect(objType.toTypeString()).toBe(
      "{ name: string; age: number; active?: boolean; }"
    );
  });

  it("should generate correct strings for union types", () => {
    const unionType = t.or(t.string, t.number);
    expect(unionType.toTypeString()).toBe("string | number");
  });

  it("should generate correct strings for intersection types", () => {
    const intersectionType = t.and(
      t.object({ x: t.number }),
      t.object({ y: t.string })
    );
    expect(intersectionType.toTypeString()).toBe(
      "{ x: number; } & { y: string; }"
    );
  });

  it("should handle nested parentheses for complex union types", () => {
    const complexUnion = t.or(t.string, t.or(t.number, t.boolean));
    expect(complexUnion.toTypeString()).toBe("string | (number | boolean)");
  });

  it("should handle nested parentheses for complex intersection types", () => {
    const complexIntersection = t.and(
      t.object({ a: t.string }),
      t.and(t.object({ b: t.number }), t.object({ c: t.boolean }))
    );
    expect(complexIntersection.toTypeString()).toBe(
      "{ a: string; } & ({ b: number; } & { c: boolean; })"
    );
  });

  it("should generate correct strings for array of unions", () => {
    const arrayOfUnions = t.array(t.or(t.string, t.number));
    expect(arrayOfUnions.toTypeString()).toBe("(string | number)[]");
  });

  it("should generate correct strings for union of arrays", () => {
    const unionOfArrays = t.or(t.array(t.string), t.array(t.number));
    expect(unionOfArrays.toTypeString()).toBe("string[] | number[]");
  });

  it("should generate correct strings for array of literals", () => {
    const arrayOfLiterals = t.array(t.enum("red", "green", "blue"));
    expect(arrayOfLiterals.toTypeString()).toBe('("red" | "green" | "blue")[]');
  });

  it("should generate correct strings for union of literal arrays", () => {
    const unionOfLiteralArrays = t.or(
      t.array(t.literal("hello")),
      t.array(t.literal("world"))
    );
    expect(unionOfLiteralArrays.toTypeString()).toBe('"hello"[] | "world"[]');
  });

  it("should generate correct strings for complex nested objects", () => {
    const complexObject = t.object({
      user: t.object({
        id: t.number,
        name: t.string,
        roles: t.array(t.enum("admin", "user", "guest")),
      }),
      metadata: t.optional(t.or(t.string, t.null)),
    });
    expect(complexObject.toTypeString()).toBe(
      '{ user: { id: number; name: string; roles: ("admin" | "user" | "guest")[]; }; metadata?: string | null; }'
    );
  });

  it("should generate correct strings for array of complex objects", () => {
    const arrayOfObjects = t.array(
      t.object({
        id: t.number,
        tags: t.array(t.string),
      })
    );
    expect(arrayOfObjects.toTypeString()).toBe(
      "{ id: number; tags: string[]; }[]"
    );
  });

  it("should generate correct strings for union of objects and primitives", () => {
    const mixedUnion = t.or(
      t.string,
      t.object({ type: t.literal("object"), value: t.number }),
      t.array(t.boolean)
    );
    expect(mixedUnion.toTypeString()).toBe(
      'string | { type: "object"; value: number; } | boolean[]'
    );
  });

  it("should generate correct strings for deeply nested unions and intersections", () => {
    const deeplyNested = t.or(
      t.and(
        t.object({ a: t.string }),
        t.object({ b: t.or(t.number, t.boolean) })
      ),
      t.array(t.and(t.object({ x: t.string }), t.object({ y: t.number })))
    );
    expect(deeplyNested.toTypeString()).toBe(
      "({ a: string; } & { b: number | boolean; }) | ({ x: string; } & { y: number; })[]"
    );
  });

  it("should handle nullable types", () => {
    const nullableString = t.nullable(t.string);
    expect(nullableString.toTypeString()).toBe("string | null");
  });

  it("should handle array of nullable types", () => {
    const arrayOfNullable = t.array(t.nullable(t.number));
    expect(arrayOfNullable.toTypeString()).toBe("(number | null)[]");
  });

  it("should respect nested option for top-level calls", () => {
    const unionType = t.or(t.string, t.number);
    expect(unionType.toTypeString({ nested: false })).toBe("string | number");
    expect(unionType.toTypeString({ nested: true })).toBe("(string | number)");
  });
});

describe("parseJSON", () => {
  const schema = t.object({
    name: t.string,
    age: t.number,
    active: t.optional(t.boolean),
  });

  it("should parse valid JSON successfully", () => {
    const json = '{"name": "John", "age": 30, "active": true}';
    const result = t.parseJSON(schema, json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ name: "John", age: 30, active: true });
      expect(result.errors).toBeUndefined();
      expect(result.unwrap()).toEqual({ name: "John", age: 30, active: true });
    }
  });

  it("should handle invalid JSON syntax", () => {
    const invalidJson = '{"name": "John", "age": 30'; // Missing closing brace
    const result = t.parseJSON(schema, invalidJson);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBeInstanceOf(t.ParseError);
      expect(result.errors[0].message).toBe("Failed to parse JSON");
      expect(result.errors[0].field).toEqual([]);
      expect(result.value).toBeUndefined();
      expect(() => result.unwrap()).toThrow(t.ParseError);
    }
  });

  it("should handle valid JSON with invalid schema", () => {
    const json = '{"name": "John", "age": "thirty"}'; // age should be number
    const result = t.parseJSON(schema, json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toBeInstanceOf(t.ParseError);
      expect(() => result.unwrap()).toThrow(t.ParseError);
    }
  });

  it("should handle optional fields correctly", () => {
    const json = '{"name": "John", "age": 30}'; // active is optional
    const result = t.parseJSON(schema, json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ name: "John", age: 30 });
    }
  });
});

describe("parse", () => {
  const schema = t.or(t.string, t.number);

  it("should parse valid data successfully", () => {
    const result1 = t.parse(schema, "hello");
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.value).toBe("hello");
      expect(result1.unwrap()).toBe("hello");
    }

    const result2 = t.parse(schema, 42);
    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.value).toBe(42);
    }
  });

  it("should handle invalid data", () => {
    const result = t.parse(schema, { invalid: "object" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toBeInstanceOf(t.ParseError);
      expect(() => result.unwrap()).toThrow(t.ParseError);
    }
  });
});

describe("ParseError and error handling", () => {
  describe("ParseError class", () => {
    it("should create ParseError with field path and message", () => {
      const error = new t.ParseError(["user", "name"], "expected string");
      expect(error).toBeInstanceOf(t.ParseError);
      expect(error.field).toEqual(["user", "name"]);
      expect(error.message).toBe("expected string");
    });

    it("should create ParseError with empty field path", () => {
      const error = new t.ParseError([], "root level error");
      expect(error.field).toEqual([]);
      expect(error.message).toBe("root level error");
    });

    it("should create ParseError with numeric indices in field path", () => {
      const error = new t.ParseError(["users", 0, "name"], "expected string");
      expect(error.field).toEqual(["users", 0, "name"]);
    });
  });

  describe("error collection in parse results", () => {
    it("should return multiple errors for intersection types", () => {
      const schema = t.and(
        t.object({ x: t.string }),
        t.object({ y: t.number })
      );
      const result = t.parse(schema, { x: 123, y: "invalid" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.every((e) => e instanceof t.ParseError)).toBe(
          true
        );
      }
    });

    it("should provide field path information in errors", () => {
      const schema = t.object({
        user: t.object({
          name: t.string,
          age: t.number,
        }),
      });
      const result = t.parse(schema, { user: { name: 123, age: "invalid" } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);
        // Object validation collects all errors instead of failing fast
        const nameError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["user", "name"])
        );
        expect(nameError).toBeDefined();
        expect(nameError?.message).toBe("expected string");

        const ageError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["user", "age"])
        );
        expect(ageError).toBeDefined();
        expect(ageError?.message).toBe("expected number");
      }
    });

    it("should provide specific error messages for primitive types", () => {
      const result = t.parse(t.string, 123);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected string");
      }
    });

    it("should provide specific error messages for array types", () => {
      const result = t.parse(t.array(t.string), "not an array");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected array");
      }
    });

    it("should provide specific error messages for object types", () => {
      const result = t.parse(t.object({ x: t.string }), "not an object");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected object");
      }
    });

    it("should provide specific error messages for null type", () => {
      const result = t.parse(t.null, "not null");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected null");
      }
    });

    it("should provide specific error messages for undefined type", () => {
      const result = t.parse(t.undefined, "not undefined");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected undefined");
      }
    });

    it("should provide type string in union type error messages", () => {
      const schema = t.or(t.string, t.number);
      const result = t.parse(schema, true);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe("expected string | number");
      }
    });

    it("should handle union type error cleanup", () => {
      const schema = t.or(
        t.object({ type: t.literal("A"), valueA: t.string }),
        t.object({ type: t.literal("B"), valueB: t.number })
      );
      const result = t.parse(schema, { type: "C", invalid: "data" });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Should only have the final union error, not individual failed attempts
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toContain("expected");
      }
    });
  });

  describe("field path tracking", () => {
    it("should track field paths in nested objects", () => {
      const schema = t.object({
        user: t.object({
          profile: t.object({
            name: t.string,
            settings: t.object({
              theme: t.literal("dark"),
            }),
          }),
        }),
      });

      const result = t.parse(schema, {
        user: {
          profile: {
            name: 123, // should be string
            settings: {
              theme: "light", // should be "dark"
            },
          },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);

        // Object validation now collects all errors
        const nameError = result.errors.find(
          (e) =>
            JSON.stringify(e.field) ===
            JSON.stringify(["user", "profile", "name"])
        );
        expect(nameError).toBeDefined();
        expect(nameError?.message).toBe("expected string");

        const themeError = result.errors.find(
          (e) =>
            JSON.stringify(e.field) ===
            JSON.stringify(["user", "profile", "settings", "theme"])
        );
        expect(themeError).toBeDefined();
        expect(themeError?.message).toBe('expected "dark"');
      }
    });

    it("should track field paths in arrays", () => {
      const schema = t.array(
        t.object({
          id: t.number,
          name: t.string,
        })
      );

      const result = t.parse(schema, [
        { id: 1, name: "valid" },
        { id: "invalid", name: 123 }, // both fields invalid - object collects all errors now
        { id: 3, name: "valid" },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);

        // Array still fails fast, but object within array collects all its errors
        const idError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify([1, "id"])
        );
        expect(idError).toBeDefined();
        expect(idError?.message).toBe("expected number");

        const nameError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify([1, "name"])
        );
        expect(nameError).toBeDefined();
        expect(nameError?.message).toBe("expected string");
      }
    });

    it("should track field paths in nested arrays", () => {
      const schema = t.object({
        users: t.array(
          t.object({
            name: t.string,
            tags: t.array(t.string),
          })
        ),
      });

      const result = t.parse(schema, {
        users: [
          { name: "user1", tags: ["tag1", 123] }, // invalid tag - fails fast here
          { name: 456, tags: ["valid"] }, // won't reach due to fail-fast
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);

        // Fails fast on first invalid element in nested array
        const tagError = result.errors.find(
          (e) =>
            JSON.stringify(e.field) === JSON.stringify(["users", 0, "tags", 1])
        );
        expect(tagError).toBeDefined();
        expect(tagError?.message).toBe("expected string");
      }
    });

    it("should handle array index filtering correctly", () => {
      const schema = t.array(t.string);

      // Create array with non-numeric properties (should be ignored)
      const testArray = ["valid", 123];
      (testArray as any).nonNumericProp = "should be ignored";

      const result = t.parse(schema, testArray);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual([1]); // Only numeric index 1
        expect(result.errors[0].message).toBe("expected string");
      }
    });

    it("should handle optional fields with invalid values", () => {
      const schema = t.object({
        required: t.string,
        optional: t.optional(t.number),
      });

      const result = t.parse(schema, {
        required: 123, // invalid
        optional: "not a number", // also invalid - now captured
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);

        const requiredError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["required"])
        );
        expect(requiredError?.message).toBe("expected string");

        const optionalError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["optional"])
        );
        expect(optionalError?.message).toBe("expected number");
      }
    });

    it("should handle missing required fields", () => {
      const schema = t.object({
        required: t.string,
        optional: t.optional(t.number),
      });

      const result = t.parse(schema, { optional: 42 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        const error = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["required"])
        );
        expect(error?.message).toBe("expected string");
      }
    });

    it("should handle literal type errors with proper field paths", () => {
      const schema = t.object({
        status: t.literal("active"),
        type: t.enum("user", "admin"),
      });

      const result = t.parse(schema, {
        status: "inactive", // now properly reports error
        type: "guest", // also reports error - both captured
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(2);

        const statusError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["status"])
        );
        expect(statusError).toBeDefined();
        expect(statusError?.message).toBe('expected "active"');

        const typeError = result.errors.find(
          (e) => JSON.stringify(e.field) === JSON.stringify(["type"])
        );
        expect(typeError).toBeDefined();
        expect(typeError?.message).toBe('expected "user" | "admin"');
      }
    });
  });

  describe("error boundary testing", () => {
    it("should handle deeply nested failures without stack overflow", () => {
      // Create deeply nested schema
      let schema: any = t.object({ value: t.string });
      for (let i = 0; i < 10; i++) {
        schema = t.object({ nested: schema });
      }

      // Create matching deep structure with error at the end
      let testData: any = { value: 123 }; // error here
      for (let i = 0; i < 10; i++) {
        testData = { nested: testData };
      }

      const result = t.parse(schema, testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].field.length).toBe(11); // 10 'nested' + 1 'value'
        expect(result.errors[0].field[10]).toBe("value");
      }
    });

    it("should handle arrays with many invalid elements", () => {
      const schema = t.array(t.number);
      const testData = Array(100).fill("not a number");

      const result = t.parse(schema, testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Arrays fail fast on first invalid element
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual([0]);
        expect(result.errors[0].message).toBe("expected number");
      }
    });

    it("should maintain error isolation between parse calls", () => {
      const schema = t.string;

      const result1 = t.parse(schema, 123);
      const result2 = t.parse(schema, true);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);

      if (!result1.success && !result2.success) {
        expect(result1.errors.length).toBe(1);
        expect(result2.errors.length).toBe(1);
        expect(result1.errors[0].message).toBe("expected string");
        expect(result2.errors[0].message).toBe("expected string");
      }
    });
  });
});

describe("class type checker", () => {
  class TestClass {
    constructor(public value: string) {}
  }

  class AnotherClass {
    constructor(public id: number) {}
  }

  const classChecker = t.class(TestClass);

  it("should check instances correctly", () => {
    const instance = new TestClass("test");
    const otherInstance = new AnotherClass(123);
    const plainObject = { value: "test" };

    expect(classChecker.check(instance)).toBe(true);
    expect(classChecker.check(otherInstance)).toBe(false);
    expect(classChecker.check(plainObject)).toBe(false);
    expect(classChecker.check("string")).toBe(false);
    expect(classChecker.check(null)).toBe(false);
  });

  it("should sanitize instances correctly", () => {
    const instance = new TestClass("test");
    const result = classChecker.sanitize(instance);

    expect(result.__sanitized).toBe(true);
    expect(result.value).toBe(instance);
  });

  it("should generate correct type string", () => {
    expect(classChecker.toTypeString()).toBe("TestClass");
  });

  describe("error handling", () => {
    it("should provide error messages for non-instance values", () => {
      const result1 = t.parse(classChecker, "not an instance");
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.errors.length).toBe(1);
        expect(result1.errors[0].message).toBe("expected TestClass");
      }

      const result2 = t.parse(classChecker, { value: "looks like instance" });
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.errors.length).toBe(1);
        expect(result2.errors[0].message).toBe("expected TestClass");
      }

      const result3 = t.parse(classChecker, new AnotherClass(123));
      expect(result3.success).toBe(false);
      if (!result3.success) {
        expect(result3.errors.length).toBe(1);
        expect(result3.errors[0].message).toBe("expected TestClass");
      }
    });

    it("should provide error messages with field paths in nested objects", () => {
      const schema = t.object({
        instance: classChecker,
        other: t.string,
      });

      const result = t.parse(schema, {
        instance: "not an instance",
        other: "valid",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual(["instance"]);
        expect(result.errors[0].message).toBe("expected TestClass");
      }
    });
  });
});

describe("nominal type checker", () => {
  const isPositiveNumber = (value: unknown): value is number =>
    typeof value === "number" && value > 0;

  const positiveNumberChecker = t.nominal(isPositiveNumber, "PositiveNumber");

  it("should check values using custom predicate", () => {
    expect(positiveNumberChecker.check(5)).toBe(true);
    expect(positiveNumberChecker.check(0)).toBe(false);
    expect(positiveNumberChecker.check(-5)).toBe(false);
    expect(positiveNumberChecker.check("5")).toBe(false);
    expect(positiveNumberChecker.check(null)).toBe(false);
  });

  it("should sanitize values correctly", () => {
    const result = positiveNumberChecker.sanitize(5);
    expect(result.__sanitized).toBe(true);
    expect(result.value).toBe(5);
  });

  it("should generate correct type string", () => {
    expect(positiveNumberChecker.toTypeString()).toBe("PositiveNumber");
  });

  describe("error handling", () => {
    it("should provide error messages for values that fail predicate", () => {
      const result1 = t.parse(positiveNumberChecker, -5);
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.errors.length).toBe(1);
        expect(result1.errors[0].message).toBe("expected PositiveNumber");
      }

      const result2 = t.parse(positiveNumberChecker, 0);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.errors.length).toBe(1);
        expect(result2.errors[0].message).toBe("expected PositiveNumber");
      }

      const result3 = t.parse(positiveNumberChecker, "not a number");
      expect(result3.success).toBe(false);
      if (!result3.success) {
        expect(result3.errors.length).toBe(1);
        expect(result3.errors[0].message).toBe("expected PositiveNumber");
      }
    });

    it("should provide error messages with field paths in nested objects", () => {
      const schema = t.object({
        count: positiveNumberChecker,
        name: t.string,
      });

      const result = t.parse(schema, {
        count: -10,
        name: "valid",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual(["count"]);
        expect(result.errors[0].message).toBe("expected PositiveNumber");
      }
    });

    it("should work with custom nominal types", () => {
      const isEmail = (value: unknown): value is string =>
        typeof value === "string" && value.includes("@");

      const emailChecker = t.nominal(isEmail, "Email");

      const result = t.parse(emailChecker, "not-an-email");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].message).toBe("expected Email");
      }
    });

    it("should handle nominal types in arrays", () => {
      const schema = t.array(positiveNumberChecker);

      const result = t.parse(schema, [1, 5, -2, 10]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].field).toEqual([2]); // index of -2
        expect(result.errors[0].message).toBe("expected PositiveNumber");
      }
    });
  });
});

describe("utility functions", () => {
  it("should identify type checkers correctly", () => {
    expect(t.isTypeChecker(t.string)).toBe(true);
    expect(t.isTypeChecker(t.number)).toBe(true);
    expect(t.isTypeChecker(t.object({ x: t.string }))).toBe(true);
    expect(t.isTypeChecker("not a checker")).toBe(false);
    expect(t.isTypeChecker(null)).toBe(false);
    expect(t.isTypeChecker({})).toBe(false);
  });

  it("should identify optional wrappers correctly", () => {
    const optional = t.optional(t.string);
    expect(t.isOptionalWrapper(optional)).toBe(true);
    expect(t.isOptionalWrapper(t.string)).toBe(false);
    expect(t.isOptionalWrapper("not a wrapper")).toBe(false);
    expect(t.isOptionalWrapper(null)).toBe(false);
  });
});

describe("sanitize behavior", () => {
  it("should not remove extra properties when intersecting with any", () => {
    const schema = t.and(
      t.object({
        name: t.string,
        age: t.number,
      }),
      t.any
    );

    const input = {
      name: "John",
      age: 30,
      extra: "should not be removed",
      another: 123,
    };

    const result = schema.sanitize(input);
    expect(result.value).toStrictEqual({
      name: "John",
      age: 30,
      extra: "should not be removed",
      another: 123,
    });
  });

  it("should not remove extra properties when intersecting with unknown", () => {
    const schema = t.and(
      t.object({
        name: t.string,
        age: t.number,
      }),
      t.unknown
    );

    const input = {
      name: "John",
      age: 30,
      extra: "should not be removed",
      another: 123,
    };

    const result = schema.sanitize(input);
    expect(result.value).toStrictEqual({
      name: "John",
      age: 30,
      extra: "should not be removed",
      another: 123,
    });
  });

  it("should remove extra properties from objects", () => {
    const schema = t.object({
      name: t.string,
      age: t.number,
    });

    const input = {
      name: "John",
      age: 30,
      extra: "should be removed",
      another: 123,
    };

    const result = schema.sanitize(input);
    expect(result.value).toEqual({ name: "John", age: 30 });
    expect(result.value).not.toHaveProperty("extra");
    expect(result.value).not.toHaveProperty("another");
  });

  it("should handle nested object sanitization", () => {
    const schema = t.object({
      user: t.object({
        name: t.string,
        id: t.number,
      }),
      metadata: t.optional(t.string),
    });

    const input = {
      user: {
        name: "John",
        id: 123,
        password: "secret", // should be removed
      },
      metadata: "test",
      extra: "remove me",
    };

    const result = schema.sanitize(input);
    expect(result.value).toEqual({
      user: { name: "John", id: 123 },
      metadata: "test",
    });
  });

  it("should handle union type sanitization", () => {
    const schema = t.or(
      t.object({ type: t.literal("user"), name: t.string }),
      t.object({ type: t.literal("admin"), permissions: t.array(t.string) })
    );

    const userInput = {
      type: "user" as const,
      name: "John",
      extra: "remove",
    };

    const result = schema.sanitize(userInput);
    expect(result.value).toEqual({ type: "user", name: "John" });
  });

  it("should canonicalize field ordering during sanitization", () => {
    const schema = t.object({
      name: t.string,
      age: t.number,
      email: t.string,
      active: t.boolean,
    });

    // Create input with fields in different order
    const input = {
      email: "test@example.com",
      active: true,
      name: "John",
      age: 25,
      extraField: "should be removed",
    };

    const result = schema.sanitize(input);

    // Check that the result has fields in schema order
    const resultKeys = Object.keys(result.value);
    const schemaKeys = ["name", "age", "email", "active"];

    expect(resultKeys).toEqual(schemaKeys);
    expect(result.value).toEqual({
      name: "John",
      age: 25,
      email: "test@example.com",
      active: true,
    });

    // Verify the original input order was different
    const inputKeys = Object.keys(input);
    expect(inputKeys).not.toEqual(schemaKeys);
  });

  it("should canonicalize nested object field ordering", () => {
    const schema = t.object({
      user: t.object({
        profile: t.object({
          firstName: t.string,
          lastName: t.string,
          email: t.string,
        }),
        settings: t.object({
          theme: t.string,
          notifications: t.boolean,
        }),
      }),
    });

    // Input with mixed field ordering at multiple levels
    const input = {
      user: {
        settings: {
          notifications: true,
          theme: "dark",
        },
        profile: {
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
        },
      },
    };

    const result = schema.sanitize(input);

    // Check top-level ordering
    expect(Object.keys(result.value.user)).toEqual(["profile", "settings"]);

    // Check nested profile ordering
    expect(Object.keys(result.value.user.profile)).toEqual([
      "firstName",
      "lastName",
      "email",
    ]);

    // Check nested settings ordering
    expect(Object.keys(result.value.user.settings)).toEqual([
      "theme",
      "notifications",
    ]);

    expect(result.value).toEqual({
      user: {
        profile: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
    });
  });

  it("should canonicalize field ordering with optional fields", () => {
    const schema = t.object({
      id: t.number,
      name: t.string,
      email: t.optional(t.string),
      age: t.optional(t.number),
      active: t.boolean,
    });

    // Input with some optional fields missing and different ordering
    const input = {
      active: false,
      name: "Jane",
      email: "jane@example.com",
      id: 123,
      // age is missing
    };

    const result = schema.sanitize(input);

    // Should be in schema order, with only present fields
    expect(Object.keys(result.value)).toEqual([
      "id",
      "name",
      "email",
      "active",
    ]);
    expect(result.value).toEqual({
      id: 123,
      name: "Jane",
      email: "jane@example.com",
      active: false,
    });
  });
});

describe("edge cases", () => {
  it("should handle empty objects", () => {
    const schema = t.object({});
    expect(schema.check({})).toBe(true);
    expect(schema.check({ extra: "prop" })).toBe(true);

    const result = schema.sanitize({ extra: "prop" });
    expect(result.value).toEqual({});
  });

  it("should handle arrays with mixed valid/invalid items", () => {
    const schema = t.array(t.number);
    expect(schema.check([1, 2, 3])).toBe(true);
    expect(schema.check([1, "string", 3])).toBe(false);
    expect(schema.check([])).toBe(true);
  });

  it("should handle deeply nested optional properties", () => {
    const schema = t.object({
      level1: t.optional(
        t.object({
          level2: t.optional(
            t.object({
              value: t.string,
            })
          ),
        })
      ),
    });

    expect(schema.check({})).toBe(true);
    expect(schema.check({ level1: {} })).toBe(true);
    expect(schema.check({ level1: { level2: { value: "test" } } })).toBe(true);

    // Test that undefined is accepted for optional properties
    expect(schema.check({ level1: { level2: undefined } })).toBe(true); // undefined is valid for optional

    // Test completely valid nested structure
    expect(
      schema.check({
        level1: {
          level2: {
            value: "test",
            extra: "ignored", // extra properties are allowed in checks
          },
        },
      })
    ).toBe(true);

    // Test invalid cases
    expect(schema.check({ level1: { level2: { value: 123 } } })).toBe(false); // wrong type for value
    expect(schema.check({ level1: "not an object" })).toBe(false);
  });

  it("should handle null and undefined correctly", () => {
    expect(t.null.check(null)).toBe(true);
    expect(t.null.check(undefined)).toBe(false);
    expect(t.null.check(0)).toBe(false);
    expect(t.null.check("")).toBe(false);

    expect(t.undefined.check(undefined)).toBe(true);
    expect(t.undefined.check(null)).toBe(false);
    expect(t.undefined.check(0)).toBe(false);
    expect(t.undefined.check("")).toBe(false);
  });

  it("should handle nullable types", () => {
    const nullableString = t.nullable(t.string);
    expect(nullableString.check("hello")).toBe(true);
    expect(nullableString.check(null)).toBe(true);
    expect(nullableString.check(undefined)).toBe(false);
    expect(nullableString.check(123)).toBe(false);
  });
});

describe("complex type combinations", () => {
  it("should handle intersection of objects with overlapping properties", () => {
    const schema = t.and(
      t.object({ a: t.string, shared: t.number }),
      t.object({ b: t.boolean, shared: t.number })
    );

    expect(schema.check({ a: "test", b: true, shared: 42 })).toBe(true);
    expect(schema.check({ a: "test", shared: 42 })).toBe(false); // missing b
    expect(schema.check({ b: true, shared: 42 })).toBe(false); // missing a
  });

  it("should handle union of intersections", () => {
    const schema = t.or(
      t.and(t.object({ type: t.literal("A") }), t.object({ valueA: t.string })),
      t.and(t.object({ type: t.literal("B") }), t.object({ valueB: t.number }))
    );

    expect(schema.check({ type: "A", valueA: "test" })).toBe(true);
    expect(schema.check({ type: "B", valueB: 123 })).toBe(true);
    expect(schema.check({ type: "A", valueB: 123 })).toBe(false);
    expect(schema.check({ type: "C", valueA: "test" })).toBe(false);
  });

  it("should handle array of intersections", () => {
    const schema = t.array(
      t.and(t.object({ id: t.number }), t.object({ name: t.string }))
    );

    expect(
      schema.check([
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ])
    ).toBe(true);

    expect(
      schema.check([
        { id: 1, name: "first" },
        { id: 2 }, // missing name
      ])
    ).toBe(false);
  });
});
