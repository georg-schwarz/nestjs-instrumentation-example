# Nestjs OTEL Instrumentation Example

This repository is a minimal setup similar to the one we use at [JValue](github.com/jvalue).
We had issues correctly setting up open telemetry instrumentation in the following setup:
- [nx](nx.dev) for monorepo management.
- [esbuild](https://esbuild.github.io/) for bundling out apps (bundles libraries into apps).
- [nestjs](https://nestjs.com/) as the framework.
- [js auto-instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib) to create tracing data.

**We only received some traces, but not all auto-instrumented ones**.
Thus, we debug the issue in this repo with a minimal example.
If you are looking for a fix, please use the last test below.

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


### Test3 (esbuild inject)

We instructed esbuild to load the instrumentation file first and moved the instrumentation into the app (instead of the library).
```js
const esbuildPluginTsc = require('esbuild-plugin-tsc');
const path = require('node:path');

/** @type {import('esbuild').BuildOptions}  */
module.exports = {
  keepNames: true,
  plugins: [
    esbuildPluginTsc({
      tsconfigPath: path.join(__dirname, 'tsconfig.app.json'),
    }),
  ],
  // Load instrumentation first!
  inject: [path.join(__dirname, 'src', 'instrumentation.ts')],
};
```

This time, the instrumentation happens before loading the nestjs modules in the bundled file:

```js

// ...

// apps/test3/src/instrumentation.ts
var instrumentation_exports = {};
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
var init_instrumentation = __esm({
  "apps/test3/src/instrumentation.ts"() {
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

// apps/test3/src/main.ts
init_instrumentation();
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

// ...

```

But somehow the error message remains:
```
@opentelemetry/instrumentation-nestjs-core Module @nestjs/core has been loaded before @opentelemetry/instrumentation-nestjs-core so it might not work, please initialize it before requiring @nestjs/core
```


### Test4 (node --require <path-to-instrumentation>)

In test4, we forced preloading the instrumentation files by using the `--require` flag of node.
Therefore, we instructed the `node` process with these parameters in the `project.json` file:
```json
// ....
    "serve": {
      "executor": "@nx/js:node",
      "defaultConfiguration": "development",
      "dependsOn": [
        "build"
      ],
      "options": {
        "buildTarget": "test4:build",
        "runBuildTargetDependencies": false,
        "runtimeArgs": ["--require", "./dist/apps/test4/instrumentation.js"] // << use --require
      },
// ...
```

The result is a working instrumentation, we can also see nestjs specific traces being logged.
Last open point is now moving the instrumentation logic back to a library to share among apps.


### Test5 (final solution)

In test5, we used the learnings from test4 to use the library in the `instrumentation.js`.
This allows each app to configure the tracing individually while still sharing code:
```js
import { instrumentation1 } from 'instrumentation';

instrumentation1.startTracingSDK({
  serviceName: 'test1',
  otelReceiverEndpoint: process.env.OTEL_RECEIVER_ENDPOINT,
});
```

## Closing

That's it! :tada:
We debugged the whole issue step by step using minimal examples.
I hope you can profit from my learnings as well.
If yes, I appreciate your **star :star: on the repo**!
