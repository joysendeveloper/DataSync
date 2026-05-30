'use strict';
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');

// gRPC endpoint — no http:// prefix
const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT; // e.g. localhost:4317

const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: OTEL_ENDPOINT }),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: OTEL_ENDPOINT }),
        exportIntervalMillis: 30_000,
    }),
    logRecordProcessors: [
        new BatchLogRecordProcessor(new OTLPLogExporter({ url: OTEL_ENDPOINT })),
    ],
    instrumentations: [getNodeAutoInstrumentations()],
});

// sdk.start() is synchronous in v0.48+
try {
    sdk.start();
    console.log('OpenTelemetry SDK started');
} catch (err) {
    console.error('OTel SDK failed to start', err);
}

process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
});