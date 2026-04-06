import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- Decorator Templates ---

type DecoratorType = "class" | "method" | "property" | "parameter";

interface DecoratorTemplate {
  name: string;
  type: DecoratorType;
  description: string;
  generate: () => string;
}

const templates: DecoratorTemplate[] = [
  {
    name: "Log",
    type: "method",
    description: "Log method calls with arguments and return value",
    generate: () => `/**
 * @Log - Method decorator that logs calls with arguments and return value.
 *
 * @example
 * class UserService {
 *   @Log
 *   getUser(id: number) { return { id, name: "Alice" }; }
 * }
 */
function Log(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    console.log(\`[\${propertyKey}] called with:\`, args);
    const result = original.apply(this, args);
    console.log(\`[\${propertyKey}] returned:\`, result);
    return result;
  };
  return descriptor;
}`,
  },
  {
    name: "Memoize",
    type: "method",
    description: "Cache method results based on arguments",
    generate: () => `/**
 * @Memoize - Method decorator that caches results keyed by serialized arguments.
 *
 * @example
 * class MathService {
 *   @Memoize
 *   fibonacci(n: number): number {
 *     return n <= 1 ? n : this.fibonacci(n - 1) + this.fibonacci(n - 2);
 *   }
 * }
 */
function Memoize(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const original = descriptor.value;
  const cache = new Map<string, unknown>();
  descriptor.value = function (...args: unknown[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = original.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}`,
  },
  {
    name: "Throttle",
    type: "method",
    description: "Throttle method invocations to at most once per interval",
    generate: () => `/**
 * @Throttle - Factory decorator that limits method calls to once per interval.
 *
 * @param ms - Minimum milliseconds between invocations.
 *
 * @example
 * class ScrollHandler {
 *   @Throttle(200)
 *   onScroll(event: Event) { console.log("scroll"); }
 * }
 */
function Throttle(ms: number) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    let lastCall = 0;
    descriptor.value = function (...args: unknown[]) {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        return original.apply(this, args);
      }
    };
    return descriptor;
  };
}`,
  },
  {
    name: "Debounce",
    type: "method",
    description: "Debounce method invocations by a delay",
    generate: () => `/**
 * @Debounce - Factory decorator that delays execution until calls stop for the given period.
 *
 * @param ms - Debounce delay in milliseconds.
 *
 * @example
 * class SearchBox {
 *   @Debounce(300)
 *   search(query: string) { console.log("searching", query); }
 * }
 */
function Debounce(ms: number) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    let timer: ReturnType<typeof setTimeout> | undefined;
    descriptor.value = function (...args: unknown[]) {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        original.apply(this, args);
      }, ms);
    };
    return descriptor;
  };
}`,
  },
  {
    name: "Validate",
    type: "parameter",
    description: "Mark a parameter for runtime validation (non-null / non-undefined)",
    generate: () => `/**
 * @Validate - Parameter decorator that registers the parameter index for validation.
 * Use together with the \`RunValidation\` method decorator to enforce non-null checks.
 *
 * @example
 * class OrderService {
 *   @RunValidation
 *   createOrder(@Validate orderId: string, @Validate amount: number) {
 *     return { orderId, amount };
 *   }
 * }
 */
const VALIDATED_PARAMS = Symbol("validated_params");

function Validate(
  target: object,
  propertyKey: string | symbol,
  parameterIndex: number
): void {
  const existing: number[] =
    Reflect.getOwnMetadata(VALIDATED_PARAMS, target, propertyKey) ?? [];
  existing.push(parameterIndex);
  Reflect.defineMetadata(VALIDATED_PARAMS, existing, target, propertyKey);
}

/**
 * @RunValidation - Method decorator that checks all @Validate-marked parameters
 * are neither null nor undefined before executing the method.
 */
function RunValidation(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    const indices: number[] =
      Reflect.getOwnMetadata(VALIDATED_PARAMS, target, propertyKey) ?? [];
    for (const index of indices) {
      if (args[index] === null || args[index] === undefined) {
        throw new Error(
          \`Parameter at index \${index} of \${propertyKey} must not be null or undefined.\`
        );
      }
    }
    return original.apply(this, args);
  };
  return descriptor;
}`,
  },
  {
    name: "Readonly",
    type: "property",
    description: "Make a class property read-only after initialization",
    generate: () => `/**
 * @Readonly - Property decorator that prevents reassignment after the first write.
 *
 * @example
 * class Config {
 *   @Readonly
 *   apiUrl: string = "https://api.example.com";
 * }
 */
function Readonly(target: object, propertyKey: string): void {
  let value: unknown;
  let initialized = false;

  Object.defineProperty(target, propertyKey, {
    get() {
      return value;
    },
    set(newValue: unknown) {
      if (initialized) {
        throw new Error(
          \`Cannot reassign readonly property "\${propertyKey}".\`
        );
      }
      value = newValue;
      initialized = true;
    },
    enumerable: true,
    configurable: false,
  });
}`,
  },
  {
    name: "Deprecated",
    type: "method",
    description: "Log a deprecation warning when the method is called",
    generate: () => `/**
 * @Deprecated - Factory decorator that emits a console warning on each call.
 *
 * @param message - Optional custom deprecation message.
 *
 * @example
 * class LegacyApi {
 *   @Deprecated("Use fetchV2 instead")
 *   fetch(url: string) { return null; }
 * }
 */
function Deprecated(message?: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      console.warn(
        \`DEPRECATED: \${propertyKey} is deprecated.\${message ? " " + message : ""}\`
      );
      return original.apply(this, args);
    };
    return descriptor;
  };
}`,
  },
  {
    name: "Retry",
    type: "method",
    description: "Automatically retry a method on failure",
    generate: () => `/**
 * @Retry - Factory decorator that retries the method up to N times on error.
 *
 * @param attempts - Maximum number of attempts (default 3).
 * @param delayMs  - Delay between retries in milliseconds (default 0).
 *
 * @example
 * class HttpClient {
 *   @Retry(3, 1000)
 *   async fetchData(url: string): Promise<unknown> {
 *     const res = await fetch(url);
 *     if (!res.ok) throw new Error("Request failed");
 *     return res.json();
 *   }
 * }
 */
function Retry(attempts = 3, delayMs = 0) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      let lastError: unknown;
      for (let i = 0; i < attempts; i++) {
        try {
          return await original.apply(this, args);
        } catch (err) {
          lastError = err;
          if (i < attempts - 1 && delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      throw lastError;
    };
    return descriptor;
  };
}`,
  },
  {
    name: "Measure",
    type: "method",
    description: "Measure and log method execution time",
    generate: () => `/**
 * @Measure - Method decorator that logs execution duration via \`performance.now()\`.
 *
 * @example
 * class DataProcessor {
 *   @Measure
 *   processRecords(records: unknown[]) {
 *     // heavy computation
 *   }
 * }
 */
function Measure(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const original = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    const start = performance.now();
    const result = original.apply(this, args);
    const end = performance.now();
    console.log(\`[\${propertyKey}] executed in \${(end - start).toFixed(2)}ms\`);
    return result;
  };
  return descriptor;
}`,
  },
];

// --- CLI ---

const program = new Command();

program
  .name("ts-decorator-gen")
  .description(
    "Generate TypeScript decorator boilerplate for classes, methods, and properties"
  )
  .version("1.0.0");

program
  .command("list")
  .description("List all available decorator templates")
  .action(() => {
    console.log(chalk.bold("\nAvailable decorator templates:\n"));
    const maxName = Math.max(...templates.map((t) => t.name.length));
    const maxType = Math.max(...templates.map((t) => t.type.length));
    for (const t of templates) {
      const name = chalk.green(t.name.padEnd(maxName));
      const type = chalk.cyan(t.type.padEnd(maxType));
      console.log(`  ${name}  ${type}  ${t.description}`);
    }
    console.log();
  });

program
  .command("generate")
  .description("Generate decorator file(s)")
  .option("-n, --name <name>", "Decorator name to generate")
  .option(
    "-t, --type <type>",
    "Filter by target type (class, method, property, parameter)"
  )
  .option("-o, --output <path>", "Output file path", "decorators.ts")
  .option("--all", "Generate all common decorators")
  .action(
    (opts: {
      name?: string;
      type?: string;
      output: string;
      all?: boolean;
    }) => {
      let selected: DecoratorTemplate[] = [];

      if (opts.all) {
        selected = templates;
      } else if (opts.name) {
        const match = templates.find(
          (t) => t.name.toLowerCase() === opts.name!.toLowerCase()
        );
        if (!match) {
          console.error(
            chalk.red(`Error: Unknown decorator "${opts.name}".`)
          );
          console.error(
            `Available: ${templates.map((t) => t.name).join(", ")}`
          );
          process.exit(1);
        }
        selected = [match];
      } else if (opts.type) {
        selected = templates.filter((t) => t.type === opts.type);
        if (selected.length === 0) {
          console.error(
            chalk.red(`Error: No decorators found for type "${opts.type}".`)
          );
          console.error("Valid types: class, method, property, parameter");
          process.exit(1);
        }
      } else {
        console.error(
          chalk.red("Error: Provide --name, --type, or --all.")
        );
        process.exit(1);
      }

      const header = `// Generated by ts-decorator-gen-cli\n// https://github.com/okirmio-create/ts-decorator-gen-cli\n`;
      const body = selected.map((t) => t.generate()).join("\n\n");
      const content = `${header}\n${body}\n`;

      const outPath = resolve(process.cwd(), opts.output);

      if (existsSync(outPath)) {
        console.log(chalk.yellow(`Overwriting ${outPath}`));
      }

      writeFileSync(outPath, content, "utf-8");

      console.log(
        chalk.green(
          `\nGenerated ${selected.length} decorator(s) -> ${outPath}\n`
        )
      );
      for (const t of selected) {
        console.log(`  ${chalk.bold(t.name)} (${chalk.cyan(t.type)})`);
      }
      console.log();
    }
  );

program.parse();
