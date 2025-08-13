export type TypeStringOptions = {
  nested?: boolean;
};

const defaultTypeStringOptions: Required<TypeStringOptions> = {
  nested: false,
};

export type Sanitized<T> = {
  __sanitized: true;
  value: T;
};

type TypeCheckerBase<in out T = any> = {
  check(value: unknown): value is T;
  sanitize(value: T): Sanitized<T>;
  toTypeString(options: TypeStringOptions): string;
};

export type TypeChecker<in out T = any> = {
  check(value: unknown): value is T;
  sanitize(value: T): Sanitized<T>;
  toTypeString(options?: TypeStringOptions): string;
  refine(
    check: (value: T) => boolean,
    message?: string | ((value: T) => string)
  ): TypeChecker<T>;
};

function createTypeChecker<T>(base: TypeCheckerBase<T>): TypeChecker<T> {
  const result: TypeChecker<T> = {
    ...base,
    toTypeString(options?: TypeStringOptions): string {
      return base.toTypeString({
        ...defaultTypeStringOptions,
        ...(options ?? {}),
      });
    },
    refine(check, message = "invalid value") {
      return createTypeChecker<T>({
        ...base,
        check(value: unknown): value is T {
          if (!base.check(value)) {
            return false;
          }

          if (!check(value)) {
            const computedMessage =
              typeof message === "string" ? message : message(value);
            currentErrors?.push(
              new ParseError([...currentField], computedMessage)
            );
            return false;
          }

          return true;
        },
      });
    },
  };
  return result;
}

export type OptionalWrapper<T> = { optional: TypeChecker<T> };

export function isTypeChecker<T = unknown>(
  value: unknown
): value is TypeChecker<T> {
  return value instanceof Object && "check" in value && "toTypeString" in value;
}

export function isOptionalWrapper<T = unknown>(
  value: unknown
): value is OptionalWrapper<T> {
  return value instanceof Object && "optional" in value;
}

function _class<T extends abstract new (...args: any) => any>(
  classObj: T
): TypeChecker<InstanceType<T>> {
  return createTypeChecker({
    check(value): value is InstanceType<T> {
      if (!(value instanceof classObj)) {
        currentErrors?.push(
          new ParseError([...currentField], `expected ${classObj.name}`)
        );
        return false;
      }

      return true;
    },
    sanitize(value) {
      return {
        __sanitized: true,
        value,
      };
    },
    toTypeString() {
      return classObj.name;
    },
  });
}
export { _class as class };

export function nominal<T>(
  checker: (value: unknown) => value is T,
  name: string
): TypeChecker<T> {
  return createTypeChecker({
    check(value): value is T {
      if (!checker(value)) {
        currentErrors?.push(
          new ParseError([...currentField], `expected ${name}`)
        );
        return false;
      }

      return true;
    },
    sanitize(value) {
      return {
        __sanitized: true,
        value,
      };
    },
    toTypeString() {
      return name;
    },
  });
}

export type TypeOf<T> = T extends TypeChecker<infer K>
  ? K
  : T extends OptionalWrapper<infer K>
  ? K | undefined
  : never;
type TypeOfDefaultTop<T> = T extends TypeChecker<infer K>
  ? K
  : T extends OptionalWrapper<infer K>
  ? K | undefined
  : unknown;

export type FieldPath = (string | number)[];

export class ParseError extends Error {
  constructor(public field: FieldPath, message: string) {
    super(message);
  }
}

export type ParseResult<T> =
  | {
      success: true;
      value: T;
      errors: undefined;
      unwrap: () => T;
    }
  | {
      success: false;
      value: undefined;
      errors: ParseError[];
      unwrap: () => never;
    };

export function parseJSON<T>(
  schema: TypeChecker<T>,
  json: string
): ParseResult<T> {
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    const error = new ParseError([], "Failed to parse JSON");
    return {
      success: false,
      value: undefined,
      errors: [error],
      unwrap: () => {
        throw error;
      },
    };
  }

  return parse(schema, obj);
}

let currentErrors: ParseError[] | undefined;
const currentField: FieldPath = [];
export function parse<T>(schema: TypeChecker<T>, obj: unknown): ParseResult<T> {
  const save = currentErrors;
  currentErrors = [];
  try {
    if (!schema.check(obj)) {
      const errors = currentErrors;
      return {
        success: false,
        value: undefined,
        errors,
        unwrap: () => {
          throw errors[0];
        },
      };
    }
  } finally {
    currentErrors = save;
  }

  const { value } = schema.sanitize(obj);
  return {
    success: true,
    value,
    errors: undefined,
    unwrap: () => value,
  };
}

export function optional<T>(type: TypeChecker<T>): OptionalWrapper<T> {
  return { optional: type };
}

export function array<T>(type: TypeChecker<T>): TypeChecker<T[]> {
  return createTypeChecker({
    check(value): value is T[] {
      if (!(value instanceof Array)) {
        currentErrors?.push(
          new ParseError([...currentField], "expected array")
        );
        return false;
      }

      for (const [i, v] of Object.entries(value)) {
        if (String(parseInt(i)) !== i) {
          continue;
        }

        try {
          currentField.push(Number(i));
          const success = type.check(v);
          if (!success) {
            return false;
          }
        } finally {
          currentField.pop();
        }
      }

      return true;
    },
    sanitize(value) {
      const newValue: T[] = Array(value.length);

      for (const [k, v] of Object.entries(value)) {
        newValue[Number(k)] = type.sanitize(v).value;
      }

      return {
        __sanitized: true,
        value: newValue,
      };
    },
    toTypeString(options) {
      return (
        type.toTypeString({
          ...options,
          nested: true,
        }) + "[]"
      );
    },
  });
}

type UnwrapType<T> = T extends OptionalWrapper<infer U>
  ? U
  : T extends TypeChecker<infer U>
  ? U
  : never;
type ObjectTypeFn<T> = {
  [I in keyof T as T[I] extends OptionalWrapper<any> ? I : never]?: UnwrapType<
    T[I]
  >;
} & {
  [I in keyof T as T[I] extends OptionalWrapper<any> ? never : I]: UnwrapType<
    T[I]
  >;
};
export function object<
  T extends {
    [key: string]: TypeChecker<any> | OptionalWrapper<any>;
  }
>(
  schema: T
): TypeChecker<{ [K in keyof ObjectTypeFn<T>]: ObjectTypeFn<T>[K] }> {
  type Target = { [K in keyof ObjectTypeFn<T>]: ObjectTypeFn<T>[K] };
  return createTypeChecker({
    check(value): value is Target {
      if (!(value instanceof Object)) {
        currentErrors?.push(
          new ParseError([...currentField], "expected object")
        );
        return false;
      }

      let good = true;
      for (const [key, type] of Object.entries(schema)) {
        try {
          currentField.push(key);
          if (isOptionalWrapper(type)) {
            if (
              Object.hasOwn(value, key) &&
              (value as any)[key] !== undefined
            ) {
              const success = type.optional.check((value as any)[key]);
              if (!success) {
                good = false;
              }
            }
          } else {
            const success = type.check((value as any)[key]);
            if (!success) {
              good = false;
            }
          }
        } finally {
          currentField.pop();
        }
      }

      return good;
    },
    sanitize(value: Target): Sanitized<Target> {
      const newValue: { [key: string]: unknown } = {};

      for (const [key, type] of Object.entries(schema)) {
        if (isOptionalWrapper(type)) {
          if (Object.hasOwn(value, key) && (value as any)[key] !== undefined) {
            newValue[key] = type.optional.sanitize((value as any)[key]).value;
          }
        } else {
          newValue[key] = type.sanitize((value as any)[key]).value;
        }
      }

      return {
        __sanitized: true,
        value: newValue as Target,
      };
    },
    toTypeString(options) {
      let result = "";
      result += "{";
      for (const [key, inputType] of Object.entries(schema)) {
        const optional = isOptionalWrapper(inputType);
        const type = optional ? inputType.optional : inputType;
        result += ` ${key}${optional ? "?" : ""}: ${type.toTypeString({
          ...options,
          nested: false,
        })};`;
      }
      result += " }";
      return result === "{ }" ? "{}" : result;
    },
  });
}

type LiteralBase = string | number | boolean | null | undefined;

export function literal<T extends LiteralBase>(arg: T): TypeChecker<T> {
  return createTypeChecker({
    check(value): value is T {
      if (value !== arg) {
        currentErrors?.push(
          new ParseError([...currentField], `expected ${this.toTypeString({})}`)
        );
        return false;
      }

      return true;
    },
    sanitize() {
      return {
        __sanitized: true,
        value: arg,
      };
    },
    toTypeString() {
      if (typeof arg === "string") {
        return JSON.stringify(arg);
      } else if (arg === null) {
        return "null";
      } else if (arg === undefined) {
        return "undefined";
      } else {
        return String(arg);
      }
    },
  });
}

function _enum<T extends LiteralBase[]>(...args: T): TypeChecker<T[number]> {
  return or(...args.map(literal));
}
export { _enum as enum };

export function or<T extends TypeChecker[]>(
  ...args: T
): TypeChecker<TypeOf<T[number]>> {
  type Target = TypeOf<T[number]>;
  return createTypeChecker({
    check(value): value is Target {
      for (const type of args) {
        const len = currentErrors?.length ?? 0;
        if (type.check(value)) {
          return true;
        }
        while (currentErrors && currentErrors.length > len) {
          currentErrors.pop();
        }
      }

      currentErrors?.push(
        new ParseError([...currentField], `expected ${this.toTypeString({})}`)
      );
      return false;
    },
    sanitize(value) {
      const obj: any = {};
      for (const type of args) {
        if (type.check(value)) {
          const sanitized = type.sanitize(value).value;
          if (sanitized instanceof Object && sanitized.constructor === Object) {
            for (const [k, v] of Object.entries(sanitized)) {
              obj[k] = v;
            }
          } else {
            return {
              __sanitized: true,
              value: sanitized,
            };
          }
        }
      }

      return {
        __sanitized: true,
        value: obj,
      };
    },
    toTypeString(options) {
      let result = "";
      if (options.nested) {
        result += "(";
      }
      result += args
        .map((type) =>
          type.toTypeString({
            ...options,
            nested: true,
          })
        )
        .join(" | ");
      if (options.nested) {
        result += ")";
      }
      return result;
    },
  });
}

export function and<T extends TypeChecker[]>(
  ...args: T
): TypeChecker<
  TypeOfDefaultTop<T[0]> &
    TypeOfDefaultTop<T[1]> &
    TypeOfDefaultTop<T[2]> &
    TypeOfDefaultTop<T[3]> &
    TypeOfDefaultTop<T[4]> &
    TypeOfDefaultTop<T[5]> &
    TypeOfDefaultTop<T[6]> &
    TypeOfDefaultTop<T[7]> &
    TypeOfDefaultTop<T[8]> &
    TypeOfDefaultTop<T[9]>
> {
  type Target = TypeOfDefaultTop<T[0]> &
    TypeOfDefaultTop<T[1]> &
    TypeOfDefaultTop<T[2]> &
    TypeOfDefaultTop<T[3]> &
    TypeOfDefaultTop<T[4]> &
    TypeOfDefaultTop<T[5]> &
    TypeOfDefaultTop<T[6]> &
    TypeOfDefaultTop<T[7]> &
    TypeOfDefaultTop<T[8]> &
    TypeOfDefaultTop<T[9]>;
  return createTypeChecker({
    check(value): value is Target {
      let good = true;
      for (const type of args) {
        // this will naturally populate currentErrors appropriately
        if (!type.check(value)) {
          good = false;
        }
      }

      return good;
    },
    sanitize(value) {
      const obj: any = {};
      for (const type of args) {
        if (type.check(value)) {
          const sanitized = type.sanitize(value).value;
          if (sanitized instanceof Object && sanitized.constructor === Object) {
            for (const [k, v] of Object.entries(sanitized)) {
              obj[k] = v;
            }
          } else {
            return {
              __sanitized: true,
              value: sanitized,
            };
          }
        }
      }

      return {
        __sanitized: true,
        value: obj,
      };
    },
    toTypeString(options) {
      let result = "";
      if (options.nested) {
        result += "(";
      }
      result += args
        .map((type) =>
          type.toTypeString({
            ...options,
            nested: true,
          })
        )
        .join(" & ");
      if (options.nested) {
        result += ")";
      }
      return result;
    },
  });
}

function primitive<T>(name: string): TypeChecker<T> {
  return createTypeChecker({
    check(value): value is T {
      if (typeof value !== name) {
        currentErrors?.push(
          new ParseError([...currentField], `expected ${name}`)
        );
        return false;
      }

      return true;
    },
    sanitize(value: T): Sanitized<T> {
      return { __sanitized: true, value };
    },
    toTypeString() {
      return name;
    },
  });
}

export const number: TypeChecker<number> = primitive<number>("number");
export const string: TypeChecker<string> = primitive<string>("string");
export const boolean: TypeChecker<boolean> = primitive<boolean>("boolean");

const _null: TypeChecker<null> = createTypeChecker({
  check(value): value is null {
    if (value !== null) {
      currentErrors?.push(new ParseError([...currentField], "expected null"));
      return false;
    }

    return true;
  },
  sanitize(_value: null): Sanitized<null> {
    return { __sanitized: true, value: null };
  },
  toTypeString() {
    return "null";
  },
});
export { _null as null };

const _undefined: TypeChecker<void | undefined> = createTypeChecker({
  check(value): value is void | undefined {
    if (value !== undefined) {
      currentErrors?.push(
        new ParseError([...currentField], "expected undefined")
      );
      return false;
    }

    return true;
  },
  sanitize(_value: void | undefined): Sanitized<void | undefined> {
    return { __sanitized: true, value: undefined };
  },
  toTypeString() {
    return "undefined";
  },
});
export { _undefined as undefined };

export function nullable<T>(type: TypeChecker<T>): TypeChecker<T | null> {
  return or(type, _null);
}
