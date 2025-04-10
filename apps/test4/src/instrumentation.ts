import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

import opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagLogLevel } from '@opentelemetry/api';
import { createLogger, format, transports } from 'winston';

const logExporter = new ConsoleSpanExporter();
const exporter = new OTLPTraceExporter({
  url: process.env['OTEL_RECEIVER_ENDPOINT'],
});

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
diag.setLogger(logger, DiagLogLevel.DEBUG);

const sdk = new opentelemetry.NodeSDK({
  traceExporter: exporter,
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors: [
    new SimpleSpanProcessor(exporter),
    new SimpleSpanProcessor(logExporter),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
