# ts-decorator-gen-cli

Generate TypeScript decorator boilerplate for classes, methods, and properties.

## Install

```bash
npm install -g ts-decorator-gen-cli
```

## Usage

### Generate a specific decorator

```bash
ts-decorator-gen generate -n Log -t method -o decorators.ts
ts-decorator-gen generate -n Readonly -t property -o decorators.ts
ts-decorator-gen generate -n Validate -t parameter -o decorators.ts
```

### Generate all common decorators

```bash
ts-decorator-gen generate --all -o decorators.ts
```

### List available templates

```bash
ts-decorator-gen list
```

## Available Decorators

| Decorator     | Type      | Description                          |
|---------------|-----------|--------------------------------------|
| `@Log`        | method    | Log method calls with arguments      |
| `@Memoize`    | method    | Cache method results                 |
| `@Throttle`   | method    | Throttle method invocations          |
| `@Debounce`   | method    | Debounce method invocations          |
| `@Validate`   | parameter | Validate parameters                  |
| `@Readonly`   | property  | Make property read-only              |
| `@Deprecated` | method    | Mark method as deprecated            |
| `@Retry`      | method    | Auto-retry on failure                |
| `@Measure`    | method    | Measure execution time               |

## Options

| Flag             | Description                        |
|------------------|------------------------------------|
| `-n, --name`     | Decorator name                     |
| `-t, --type`     | Target type (class/method/property/parameter) |
| `-o, --output`   | Output file path                   |
| `--all`          | Generate all common decorators     |

## License

MIT
