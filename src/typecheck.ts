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

export type TypeChecker<in out T = any> = {
  check(value: unknown): value is T;
  sanitize(value: T): Sanitized<T>;
  toTypeString(options: TypeStringOptions): string;
};

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
  return {
    check(value): value is InstanceType<T> {
      return value instanceof classObj;
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
  };
}
export { _class as class };

export function nominal<T>(
  checker: (value: unknown) => value is T,
  name: string
): TypeChecker<T> {
  return {
    check(value): value is T {
      return checker(value);
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
  };
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

export class ParseError extends Error {}

export type ParseResult<T> =
  | {
      success: true;
      value: T;
      error: undefined;
      unwrap: () => T;
    }
  | {
      success: false;
      value: undefined;
      error: ParseError;
      unwrap: () => never;
    };

export function parseJSON<T>(
  schema: TypeChecker<T>,
  json: string
): ParseResult<T> {
  // TODO: add location information to errors
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    const error = new ParseError("Failed to parse JSON");
    return {
      success: false,
      value: undefined,
      error,
      unwrap: () => {
        throw error;
      },
    };
  }

  return parse(schema, obj);
}

export function parse<T>(schema: TypeChecker<T>, obj: unknown): ParseResult<T> {
  // TODO: add location information to errors
  if (!schema.check(obj)) {
    const error = new ParseError("Invalid type");
    return {
      success: false,
      value: undefined,
      error,
      unwrap: () => {
        throw error;
      },
    };
  }

  const { value } = schema.sanitize(obj);
  return {
    success: true,
    value,
    error: undefined,
    unwrap: () => value,
  };
}

export function optional<T>(type: TypeChecker<T>): OptionalWrapper<T> {
  return { optional: type };
}

export function array<T>(type: TypeChecker<T>): TypeChecker<T[]> {
  return {
    check(value): value is T[] {
      if (!(value instanceof Array)) {
        return false;
      }

      for (const [_, v] of Object.entries(value)) {
        const success = type.check(v);
        if (!success) {
          return false;
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
    toTypeString(_options) {
      const options = { ...defaultTypeStringOptions, ..._options };
      return (
        type.toTypeString({
          ...options,
          nested: true,
        }) + "[]"
      );
    },
  };
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
  return {
    check(value): value is Target {
      if (!(value instanceof Object)) {
        return false;
      }

      for (const [key, type] of Object.entries(schema)) {
        if (isOptionalWrapper(type)) {
          if (Object.hasOwn(value, key) && (value as any)[key] !== undefined) {
            const success = type.optional.check((value as any)[key]);
            if (!success) {
              return false;
            }
          }
        } else {
          const success = type.check((value as any)[key]);
          if (!success) {
            return false;
          }
        }
      }

      return true;
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
    toTypeString(_options) {
      const options = { ...defaultTypeStringOptions, ..._options };
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
  };
}

type LiteralBase = string | number | boolean | null | undefined;

export function literal<T extends LiteralBase>(arg: T): TypeChecker<T> {
  return {
    check(value): value is T {
      return value === arg;
    },
    sanitize() {
      return {
        __sanitized: true,
        value: arg,
      };
    },
    toTypeString() {
      if (typeof arg === "string") {
        // TODO: proper escaping
        return `"${arg}"`;
      } else if (arg === null) {
        return "null";
      } else if (arg === undefined) {
        return "undefined";
      } else {
        return String(arg);
      }
    },
  };
}

function _enum<T extends LiteralBase[]>(...args: T): TypeChecker<T[number]> {
  return or(...args.map(literal));
}
export { _enum as enum };

export function or<T extends TypeChecker[]>(
  ...args: T
): TypeChecker<TypeOf<T[number]>> {
  type Target = TypeOf<T[number]>;
  return {
    check(value): value is Target {
      for (const type of args) {
        if (type.check(value)) {
          return true;
        }
      }

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
            return sanitized;
          }
        }
      }

      return obj;
    },
    toTypeString(_options) {
      const options = { ...defaultTypeStringOptions, ..._options };
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
  };
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
  return {
    check(value): value is Target {
      for (const type of args) {
        if (!type.check(value)) {
          return false;
        }
      }

      return true;
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
            return sanitized;
          }
        }
      }

      return obj;
    },
    toTypeString(_options) {
      const options = { ...defaultTypeStringOptions, ..._options };
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
  };
}

function primitive<T>(name: string): TypeChecker<T> {
  return {
    check(value): value is T {
      return typeof value === name;
    },
    sanitize(value: T): Sanitized<T> {
      return { __sanitized: true, value };
    },
    toTypeString() {
      return name;
    },
  };
}

export const number: TypeChecker<number> = primitive<number>("number");
export const string: TypeChecker<string> = primitive<string>("string");
export const boolean: TypeChecker<boolean> = primitive<boolean>("boolean");

const _null: TypeChecker<null> = {
  check(value): value is null {
    return value === null;
  },
  sanitize(_value: null): Sanitized<null> {
    return { __sanitized: true, value: null };
  },
  toTypeString() {
    return "null";
  },
};
export { _null as null };

const _undefined: TypeChecker<void | undefined> = {
  check(value): value is void | undefined {
    return value === undefined;
  },
  sanitize(_value: void | undefined): Sanitized<void | undefined> {
    return { __sanitized: true, value: undefined };
  },
  toTypeString() {
    return "undefined";
  },
};
export { _undefined as undefined };

export function nullable<T>(type: TypeChecker<T>): TypeChecker<T | null> {
  return or(type, _null);
}
