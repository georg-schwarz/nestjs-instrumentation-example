import { credentials } from '@grpc/grpc-js';
import { DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

import { Resource } from '@opentelemetry/resources';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

interface TracingConfig {
  serviceName: string;
  otelReceiverEndpoint?: string;
}

export function startTracingSDK(config: TracingConfig) {
  console.info('Instrumenting OpenTelemetry...');

  if (!config.otelReceiverEndpoint) {
    console.error(
      'Otel receiver endpoint is not set but otel feature is enabled. Check your tracing configuration! Exiting...',
    );
    process.exit(1);
  }
  console.info(`Using OTLP endpoint: ${config.otelReceiverEndpoint}`);

  const exporter = new OTLPTraceExporter({
    url: config.otelReceiverEndpoint,
    credentials: credentials.createInsecure(),
  });
  const logExporter = new ConsoleSpanExporter();

  const logger = {
    verbose: (msg: string) => {
      console.debug(msg);
    },
    ...console
  }
  diag.setLogger(logger, DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter), new SimpleSpanProcessor(logExporter)],
  });
  provider.register();

  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations()],
  });
  console.info('Finished instrumenting OpenTelemetry');
}
