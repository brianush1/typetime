# TypeTime

A TypeScript runtime type checking and validation library that provides compile-time type safety with runtime validation.

## Features

- 🔍 **Runtime Type Checking** - Validate data at runtime with TypeScript type inference
- 🧹 **Data Sanitization** - Clean and transform data while preserving type safety
- 🔗 **Composable Types** - Build complex types from simple primitives
- 📝 **Type String Generation** - Generate human-readable type descriptions
- 🎯 **Type Refinements** - Add custom validation logic with custom error messages
- 📦 **JSON Parsing** - Parse and validate JSON with detailed error handling
- 🚨 **Rich Error Reporting** - Detailed error messages with field path tracking
- 🏗️ **Object Error Collection** - Collect all validation errors, not just the first one
- 🎭 **Class & Nominal Types** - Support for class instances and custom nominal types

## Installation

```bash
npm install typetime
# or
pnpm add typetime
# or
yarn add typetime
```

## Quick Start

```typescript
import { t } from 'typetime';

// Define a schema
const UserSchema = t.object({
  id: t.number,
  name: t.string,
  email: t.string.refine(email => email.includes('@'), 'Must be a valid email'),
  age: t.optional(t.number),
  roles: t.array(t.enum('admin', 'user', 'guest'))
});

// Type inference - TypeScript knows the exact type
type User = t.TypeOf<typeof UserSchema>;

// Runtime validation
const userData = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  roles: ["user"]
};

if (UserSchema.check(userData)) {
  // userData is now typed as User
  console.log(userData.name); // TypeScript knows this is a string
}

// Parse with error handling
const result = t.parse(UserSchema, userData);
if (result.success) {
  console.log(result.value); // Validated User object
} else {
  // Multiple errors with field paths
  result.errors.forEach(error => {
    console.error(`Error at ${error.field.join('.')}: ${error.message}`);
  });
}
```

## API Reference

### Primitive Types

```typescript
t.string     // string
t.number     // number  
t.boolean    // boolean
t.null       // null
t.undefined  // undefined
```

### Literal Types

```typescript
t.literal('hello')        // 'hello'
t.enum('red', 'green', 'blue')  // 'red' | 'green' | 'blue'
```

### Complex Types

```typescript
// Objects
t.object({
  name: t.string,
  age: t.number
})

// Arrays
t.array(t.string)  // string[]

// Optional properties
t.object({
  required: t.string,
  optional: t.optional(t.string)
})

// Nullable types
t.nullable(t.string)  // string | null
```

### Union and Intersection Types

```typescript
// Union types (OR)
t.or(t.string, t.number)  // string | number

// Intersection types (AND)
t.and(
  t.object({ x: t.number }),
  t.object({ y: t.string })
)  // { x: number } & { y: string }
```

### Refinement Types

Add custom validation logic to existing types with enhanced error messages:

```typescript
// Simple refinements with default error messages
const PositiveNumber = t.number.refine(n => n > 0);

// Custom string error messages
const ValidEmail = t.string.refine(
  s => s.includes('@') && s.includes('.'),
  'Must be a valid email address'
);

// Dynamic error messages using functions
const MinAge = t.number.refine(
  age => age >= 18,
  age => `Age ${age} is too young, must be 18 or older`
);

// Chain multiple refinements (fail-fast behavior)
const StrongPassword = t.string
  .refine(s => s.length >= 8, 'Password must be at least 8 characters')
  .refine(s => /[A-Z]/.test(s), 'Password must contain uppercase letter')
  .refine(s => /[0-9]/.test(s), 'Password must contain a number');
```

### Class Types

```typescript
class MyClass {
  constructor(public value: string) {}
}

const MyClassChecker = t.class(MyClass);
// Validates that value is an instance of MyClass
```

### Nominal Types

Create custom type checkers with specific names:

```typescript
const UserId = t.nominal(
  (value): value is number => typeof value === 'number' && value > 0,
  'UserId'
);
```

## Core Methods

Every type checker provides these methods:

### `check(value: unknown): value is T`

Type guard that returns `true` if the value matches the schema:

```typescript
const schema = t.string;
if (schema.check(someValue)) {
  // someValue is now typed as string
}
```

### `sanitize(value: T): Sanitized<T>`

Cleans data by removing extra properties from objects:

```typescript
const schema = t.object({ name: t.string });
const result = schema.sanitize({ name: "John", extra: "removed" });
console.log(result.value); // { name: "John" }
```

### `toTypeString(options?: TypeStringOptions): string`

Generates human-readable type descriptions:

```typescript
const schema = t.object({ name: t.string, age: t.number });
console.log(schema.toTypeString()); // "{ name: string, age: number }"
```

### `refine(check: (value: T) => boolean, message?: string | ((value: T) => string)): TypeChecker<T>`

Adds custom validation logic to an existing type checker with optional custom error messages:

```typescript
// Default error message
const PositiveNumber = t.number.refine(n => n > 0);

// Custom string error message
const ValidEmail = t.string.refine(
  email => email.includes('@'),
  'Must be a valid email address'
);

// Dynamic error message function
const ValidRange = t.number.refine(
  n => n >= 1 && n <= 100,
  n => `Value ${n} is out of range (1-100)`
);

// Chain multiple refinements (fail-fast)
const StrongPassword = t.string
  .refine(s => s.length >= 8, 'Too short')
  .refine(s => /[A-Z]/.test(s), 'Missing uppercase letter');
```

## Parsing Functions

### `parse<T>(schema: TypeChecker<T>, value: unknown): ParseResult<T>`

Parse and validate any value:

```typescript
const result = t.parse(t.number, "123");
if (result.success) {
  console.log(result.value); // number (if valid)
} else {
  // Enhanced error handling with multiple errors
  result.errors.forEach(error => {
    console.error(`Field ${error.field.join('.')}: ${error.message}`);
  });
}
```

### `parseJSON<T>(schema: TypeChecker<T>, json: string): ParseResult<T>`

Parse and validate JSON strings:

```typescript
const schema = t.object({ name: t.string });
const result = t.parseJSON(schema, '{"name": "John"}');

if (result.success) {
  console.log(result.value.name); // "John"
} else {
  result.errors.forEach(error => {
    console.error(`JSON Error at ${error.field.join('.')}: ${error.message}`);
  });
}
```

## Type Inference

TypeTime provides excellent TypeScript integration:

```typescript
const schema = t.object({
  users: t.array(t.object({
    id: t.number,
    name: t.string,
    active: t.optional(t.boolean)
  }))
});

// Infer the TypeScript type
type Data = t.TypeOf<typeof schema>;
// Result: { users: { id: number; name: string; active?: boolean }[] }
```

## Error Handling

TypeTime features enhanced error handling with multiple error collection and field path tracking:

### Rich Error Information

Each `ParseError` includes:
- **Field path**: Array showing exactly where the error occurred
- **Detailed message**: Specific error description
- **Multiple errors**: Objects collect all validation errors, not just the first one

```typescript
const schema = t.object({
  user: t.object({
    name: t.string,
    email: t.string.refine(s => s.includes('@'), 'Invalid email'),
    age: t.number
  })
});

const result = t.parse(schema, {
  user: {
    name: 123,        // Error: expected string
    email: "invalid", // Error: Invalid email  
    age: "25"        // Error: expected number
  }
});

if (!result.success) {
  result.errors.forEach(error => {
    console.log(`Path: ${error.field.join('.')}`);
    console.log(`Message: ${error.message}`);
  });
  // Output:
  // Path: user.name, Message: expected string
  // Path: user.email, Message: Invalid email
  // Path: user.age, Message: expected number
}
```

### Safe Result Checking

```typescript
const result = t.parseJSON(schema, jsonString);

if (result.success) {
  // Safe access to validated data
  console.log(result.value); // Typed data
} else {
  result.errors.forEach(error => {
    console.log(error instanceof t.ParseError); // true
    console.log(error.message); // Error description
    console.log(error.field); // Field path array
  });
}
```

### Exception-Based with `.unwrap()`

For cases where you want to assume parsing succeeds and handle errors via exceptions:

```typescript
try {
  // Throws first ParseError if validation fails
  const data = t.parseJSON(schema, jsonString).unwrap();
  
  // Write code assuming parsing succeeded
  console.log(data.name); // Fully typed, no need for success checks
  processValidData(data);
  
} catch (error) {
  if (error instanceof t.ParseError) {
    console.error('Validation failed:', error.message);
    console.error('Field path:', error.field.join('.'));
  }
}
```

### Error Collection Behavior

- **Objects**: Collect all field validation errors
- **Arrays**: Fail fast on first invalid element (but collect errors from that element)
- **Intersections**: Collect errors from all intersected types
- **Unions**: Report union-level error after trying all alternatives
- **Refinements**: Fail fast on first failed refinement in a chain

## Examples

### API Response Validation

```typescript
const ApiResponse = t.object({
  success: t.boolean,
  data: t.optional(t.object({
    id: t.number,
    title: t.string,
    tags: t.array(t.string)
  })),
  error: t.optional(t.string)
});

fetch('/api/data')
  .then(res => res.json())
  .then(data => {
    const result = t.parse(ApiResponse, data);
    if (result.success) {
      // data is fully typed and validated
      console.log(result.value.data?.title);
    } else {
      // Handle validation errors with detailed paths
      result.errors.forEach(error => {
        console.error(`API Error at ${error.field.join('.')}: ${error.message}`);
      });
    }
  });
```

### Configuration Validation

```typescript
const Config = t.object({
  port: t.number.refine(
    p => p > 0 && p < 65536,
    p => `Port ${p} must be between 1 and 65535`
  ),
  host: t.string,
  database: t.object({
    url: t.string,
    maxConnections: t.optional(t.number.refine(n => n > 0, 'Must be positive'))
  }),
  features: t.object({
    auth: t.boolean,
    logging: t.enum('debug', 'info', 'warn', 'error')
  })
});

const config = t.parseJSON(Config, process.env.CONFIG_JSON);
if (config.success) {
  startServer(config.value);
} else {
  console.error('Configuration validation failed:');
  config.errors.forEach(error => {
    console.error(`  ${error.field.join('.')}: ${error.message}`);
  });
  process.exit(1);
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
