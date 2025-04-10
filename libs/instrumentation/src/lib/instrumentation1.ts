import { credentials } from '@grpc/grpc-js';
import { DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

import { Resource } from '@opentelemetry/resources';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { createLogger, format, transports } from 'winston';

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

  const logger = createLogger({
    level: 'debug',
    format: format.combine(format.timestamp(), format.colorize(), format.printf((input) => {
      const { timestamp, context, level, message, stack } = input;
    
      let formattedMessage = `${timestamp} [${context}] ${level}: ${message}`;
      if (stack != null) {
        formattedMessage += ` - ${stack.toString()}`;
      }
      return formattedMessage;
    })),
    transports: [
      new transports.Console({
        handleExceptions: true,
        handleRejections: true,
      })
    ]
  })
  diag.setLogger(logger, DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter), new SimpleSpanProcessor(logExporter)],
  });

  registerInstrumentations({
    instrumentations: [getNodeAutoInstrumentations()],
    tracerProvider: provider,
  });
  console.info('Finished instrumenting OpenTelemetry');
}
