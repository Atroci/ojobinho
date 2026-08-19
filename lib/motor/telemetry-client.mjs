// ponytail: null telemetry client. Upstream job-application-agent shipped default-on anonymous
// analytics to a third-party worker; oJobinho sends nothing anywhere. Same interface, no network.
export class TelemetryClient {
  constructor() {}
  async beginCommand(command) {
    return { command, enabled: false, allowSend: false, installationEventPending: false };
  }
  async record() {
    return { sent: false, reason: 'disabled' };
  }
}
