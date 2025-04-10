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

Test1 does not correctly instrument the nestjs components.
No traces of [opentelementry-instrumentation-nestjs-core](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-nestjs-core) are visible in the logs of the otel receiver.
