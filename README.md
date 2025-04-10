# Nestjs OTEL Instrumentation Example

This repository is a minimal setup similar to the one we use at [JValue](github.com/jvalue).
We had issues correctly setting up open telemetry instrumentation in the following setup:
- [nx](nx.dev) for monorepo management.
- [esbuild](https://esbuild.github.io/) for bundling out apps (bundles libraries into apps).
- [nestjs](https://nestjs.com/) as the framework.
- [js auto-instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib) to create tracing data.
