# cisco-serviceability

A JavaScript library to interact with the Cisco Control Center Services API via SOAP. Supports both the `ControlCenterServices` and `ControlCenterServicesEx` endpoints for managing services on Cisco Unified Communications Manager (CUCM).

## Installation

```bash
npm install cisco-serviceability
```

## Usage

```javascript
const controlCenterService = require("cisco-serviceability");

// Initialize with CUCM publisher host, username, and password
const service = new controlCenterService("cucm-pub.example.com", "admin", "password");

// Get all service statuses
const status = await service.getServiceStatus();
console.log(status.results);

// Get status for a specific service
const cmStatus = await service.getServiceStatus("Cisco CallManager");
console.log(cmStatus.results);

// Restart a service
const result = await service.doControlServices("cucm-node", "Restart", "Cisco CallManager");
console.log(result.results);
```

### ES Module

```javascript
import controlCenterService from "cisco-serviceability";
```

### SSO Cookie Authentication

```javascript
// Initialize without credentials, pass cookie via options
const service = new controlCenterService("cucm-pub.example.com", "", "", {
  Cookie: "JSESSIONSSSO=your-sso-cookie",
});
```

## API Methods

### Control Center Services

| Method | Description |
|--------|-------------|
| `getProductInformationList()` | Lists all product and service information including ProductID, ServiceName, and DependentServices |
| `getServiceStatus(services?)` | Get the status of all services or specific service(s). Pass a string or array of strings. |
| `getStaticServiceList()` | Get the static list of all service specifications |
| `doControlServices(nodeName, controlType, services)` | Start, stop, or restart services. `controlType`: `"Start"`, `"Stop"`, or `"Restart"` |
| `doServiceDeployment(nodeName, deployType, services)` | Deploy or undeploy a service. `deployType`: `"Deploy"` or `"UnDeploy"` |

### Control Center Services Extended

| Method | Description |
|--------|-------------|
| `getFileDirectoryList(directoryPath)` | Lists files in the specified directory (e.g., `"/var/log/active/tomcat/logs/ccmservice"`) |
| `getStaticServiceListExtended()` | Detailed service list including ProductID, restrictions, and sequence numbers |
| `doControlServicesEx(productId, dependencyType, controlType, services)` | Start/stop/restart services (UCM and ELM 10.0+). `productId`: `"CallManager"`, `"Elm"`, or `"Common"` |
| `doServiceDeploymentNoDbUpdate(productId, deployType, services)` | Deploy/undeploy without database updates |

### Cookie Management

| Method | Description |
|--------|-------------|
| `getCookie()` | Returns the current stored session cookie |
| `setCookie(cookie)` | Sets a cookie for subsequent requests |

## Constructor

```javascript
new controlCenterService(host, username, password, options?, retry?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `host` | `string` | CUCM publisher IP/FQDN |
| `username` | `string` | AXL username (blank if using SSO cookie) |
| `password` | `string` | AXL password (blank if using SSO cookie) |
| `options` | `object` | Additional headers (e.g., `{ Cookie: "..." }`) |
| `retry` | `boolean` | Enable automatic retries (default: `true`) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CCS_RETRY` | Max retry attempts (default: `3`) |
| `CCS_RETRY_DELAY` | Base retry delay in ms (default: `5000`) |

## Response Format

All methods return a Promise resolving to:

```javascript
{
  cookie: "session-cookie-string",
  results: { /* parsed SOAP response */ }
}
```

## API Documentation

- [Cisco Control Center Services API](https://developer.cisco.com/docs/sxml/control-center-services-api/)

## License

MIT
