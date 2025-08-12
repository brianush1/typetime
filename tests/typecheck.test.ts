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
      expect(result.error).toBeUndefined();
      expect(result.unwrap()).toEqual({ name: "John", age: 30, active: true });
    }
  });

  it("should handle invalid JSON syntax", () => {
    const invalidJson = '{"name": "John", "age": 30'; // Missing closing brace
    const result = t.parseJSON(schema, invalidJson);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(t.ParseError);
      expect(result.error.message).toBe("Failed to parse JSON");
      expect(result.value).toBeUndefined();
      expect(() => result.unwrap()).toThrow(t.ParseError);
    }
  });

  it("should handle valid JSON with invalid schema", () => {
    const json = '{"name": "John", "age": "thirty"}'; // age should be number
    const result = t.parseJSON(schema, json);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(t.ParseError);
      expect(result.error.message).toBe("Invalid type");
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
      expect(result.error).toBeInstanceOf(t.ParseError);
      expect(result.error.message).toBe("Invalid type");
      expect(() => result.unwrap()).toThrow(t.ParseError);
    }
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
