import { instrumentation1 } from 'instrumentation';

instrumentation1.startTracingSDK({
  serviceName: 'test1',
  otelReceiverEndpoint: process.env.OTEL_RECEIVER_ENDPOINT,
});
