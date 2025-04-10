# Nestjs OTEL Instrumentation Example

This repository is a minimal setup similar to the one we use at [JValue](github.com/jvalue).
We had issues correctly setting up open telemetry instrumentation in the following setup:
- [nx](nx.dev) for monorepo management.
- [esbuild](https://esbuild.github.io/) for bundling out apps (bundles libraries into apps).
- [nestjs](https://nestjs.com/) as the framework.
- [js auto-instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib) to create tracing data.

## Run

1. Start the otel receiver
```bash
docker compose up
```

2. Start a test app
```bash
npx nx serve test1
```

3. Generate traces for a request by going to [localhost:3000](localhost:3000).

## Findings

### Test1 (our current implementation)

Test2 does instrument nestjs components correctly, but too late:
```
@opentelemetry/instrumentation-nestjs-core Module @nestjs/core has been loaded before @opentelemetry/instrumentation-nestjs-core so it might not work, please initialize it before requiring @nestjs/core
```

The issue is that esbuild executes `instrumentation1_exports.startTracingSDK` at the end of the bundled file after the imports.

### Test2 (Official guide)

Test2 does instrument nestjs components correctly, but too late:
```
@opentelemetry/instrumentation-nestjs-core Module @nestjs/core has been loaded before @opentelemetry/instrumentation-nestjs-core so it might not work, please initialize it before requiring @nestjs/core
```

The issue is that esbuild bundles as follows:
```js

// ...

// libs/instrumentation/src/index.ts
var src_exports = {};
import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import opentelemetry from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { diag, DiagLogLevel } from "@opentelemetry/api";
var logExporter, exporter, logger, provider, sdk;
var init_src = __esm({
  "libs/instrumentation/src/index.ts"() {
    "use strict";
    logExporter = new ConsoleSpanExporter();
    exporter = new OTLPTraceExporter({
      url: process.env["OTEL_RECEIVER_ENDPOINT"]
    });
    logger = {
      verbose: (msg) => {
        console.debug(msg);
      },
      ...console
    };
    diag.setLogger(logger, DiagLogLevel.DEBUG);
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.addSpanProcessor(new SimpleSpanProcessor(logExporter));
    provider.register();
    sdk = new opentelemetry.NodeSDK({
      traceExporter: exporter,
      instrumentations: [getNodeAutoInstrumentations()]
    });
    sdk.start();
    process.on("SIGTERM", () => {
      sdk.shutdown().then(() => console.log("Tracing terminated")).catch((error) => console.log("Error terminating tracing", error)).finally(() => process.exit(0));
    });
  }
});

// apps/test2/src/main.ts
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

// ...

// apps/test2/src/main.ts
init_src();
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true
    })
  );
  const port = process.env.PORT || 3e3;
  await app.listen(port);
  Logger.log(`\u{1F680} Application is running on: http://localhost:${port}`);
}
__name(bootstrap, "bootstrap");
bootstrap();
//# sourceMappingURL=main.js.map

```

The execution of `init_src` is deferred after the imports of the nestjs library.

