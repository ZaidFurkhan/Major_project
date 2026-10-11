import { connectAsync } from 'mqtt';
import { validateReading } from '../telemetry/contract.js';
import { getMachine } from '../db/machines.js';
import { insertTelemetryReading } from '../db/telemetryReadings.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTelemetryMessage(payloadBuffer) {
  if (payloadBuffer == null) {
    return { valid: false, errors: ['payload must not be null or undefined'] };
  }

  let text;
  if (Buffer.isBuffer(payloadBuffer)) {
    text = payloadBuffer.toString('utf8');
  } else if (typeof payloadBuffer === 'string') {
    text = payloadBuffer;
  } else {
    return { valid: false, errors: ['payload must be a Buffer or string'] };
  }

  try {
    const reading = JSON.parse(text);
    return { valid: true, reading };
  } catch (err) {
    return { valid: false, errors: [`JSON parse error: ${err.message}`] };
  }
}

export async function handleTelemetryMessage(pool, payloadBuffer, topic = null) {
  const parseResult = parseTelemetryMessage(payloadBuffer);
  if (!parseResult.valid) {
    return { status: 'rejected', errors: parseResult.errors };
  }

  const validationResult = validateReading(parseResult.reading);
  if (!validationResult.valid) {
    return { status: 'rejected', errors: validationResult.errors };
  }

  const reading = validationResult.value;

  if (typeof topic === 'string') {
    const segments = topic.split('/');
    if (segments.length >= 2 && segments[0] === 'mechsense') {
      const topicMachineId = segments[1];
      if (topicMachineId && topicMachineId !== '+' && topicMachineId !== reading.machineId) {
        return {
          status: 'rejected',
          errors: ['topic machine segment does not match payload machineId'],
        };
      }
    }
  }

  if (!UUID_REGEX.test(reading.machineId)) {
    return {
      status: 'rejected',
      errors: ['invalid machineId format: must be a valid UUID'],
    };
  }

  const machine = await getMachine(pool, reading.machineId);
  if (!machine) {
    return {
      status: 'rejected',
      errors: [`machine not found: ${reading.machineId}`],
    };
  }

  const insertResult = await insertTelemetryReading(pool, reading);
  if (insertResult.inserted) {
    return { status: 'stored', id: insertResult.id };
  }

  return { status: 'duplicate' };
}

export async function startMqttIngestion({
  brokerUrl,
  pool,
  topic = 'mechsense/+/telemetry',
  onResult,
}) {
  const client = await connectAsync(brokerUrl);

  client.on('error', () => {
    // Ignore transport-level errors on active client to keep running
  });

  await client.subscribeAsync(topic);

  client.on('message', async (topicString, payloadBuffer) => {
    try {
      const result = await handleTelemetryMessage(pool, payloadBuffer, topicString);
      if (typeof onResult === 'function') {
        onResult(result, topicString);
      }
    } catch (err) {
      console.error('Unexpected error handling telemetry message:', err.message);
    }
  });

  return {
    async stop() {
      await client.endAsync();
    },
  };
}
