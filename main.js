const fetch = require("fetch-retry")(global.fetch);
const parseString = require("xml2js").parseString;
const stripPrefix = require("xml2js").processors.stripPrefix;
const http = require("http");

// --- SOAP Envelope Templates ---

// Control Center Services (port 8443)
const XML_GET_PRODUCT_INFORMATION_LIST = () => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:getProductInformationList>
      <soap:ServiceInfo></soap:ServiceInfo>
   </soap:getProductInformationList>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_GET_SERVICE_STATUS = (services) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapGetServiceStatus>
      <soap:ServiceStatus>${services}</soap:ServiceStatus>
   </soap:soapGetServiceStatus>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_GET_STATIC_SERVICE_LIST = () => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapGetStaticServiceList>
      <soap:ServiceInformationResponse></soap:ServiceInformationResponse>
   </soap:soapGetStaticServiceList>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_DO_CONTROL_SERVICES = (nodeName, controlType, services) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapDoControlServices>
      <soap:ControlServiceRequest>
         <soap:NodeName>${nodeName}</soap:NodeName>
         <soap:ControlType>${controlType}</soap:ControlType>
         ${services}
      </soap:ControlServiceRequest>
   </soap:soapDoControlServices>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_DO_SERVICE_DEPLOYMENT = (nodeName, deployType, services) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapDoServiceDeployment>
      <soap:DeploymentServiceRequest>
         <soap:NodeName>${nodeName}</soap:NodeName>
         <soap:DeployType>${deployType}</soap:DeployType>
         ${services}
      </soap:DeploymentServiceRequest>
   </soap:soapDoServiceDeployment>
</soapenv:Body>
</soapenv:Envelope>`;

// Control Center Services Extended (port 8443)
const XML_GET_FILE_DIRECTORY_LIST = (directoryPath) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:getFileDirectoryList>
      <soap:DirectoryPath>${directoryPath}</soap:DirectoryPath>
   </soap:getFileDirectoryList>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_GET_STATIC_SERVICE_LIST_EXTENDED = () => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:getStaticServiceListExtended>
      <soap:ServiceInformationResponse></soap:ServiceInformationResponse>
   </soap:getStaticServiceListExtended>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_DO_CONTROL_SERVICES_EX = (productId, dependencyType, controlType, services) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapDoControlServicesEx>
      <soap:ControlServiceExRequest>
         <soap:ProductId>${productId}</soap:ProductId>
         <soap:DependencyType>${dependencyType}</soap:DependencyType>
         <soap:ControlType>${controlType}</soap:ControlType>
         ${services}
      </soap:ControlServiceExRequest>
   </soap:soapDoControlServicesEx>
</soapenv:Body>
</soapenv:Envelope>`;

const XML_DO_SERVICE_DEPLOYMENT_NO_DB_UPDATE = (productId, deployType, services) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">
<soapenv:Header/>
<soapenv:Body>
   <soap:soapDoServiceDeploymentNoDbUpdate>
      <soap:DeploymentServiceNoDbUpdateRequest>
         <soap:ProductId>${productId}</soap:ProductId>
         <soap:DeployType>${deployType}</soap:DeployType>
         ${services}
      </soap:DeploymentServiceNoDbUpdateRequest>
   </soap:soapDoServiceDeploymentNoDbUpdate>
</soapenv:Body>
</soapenv:Envelope>`;

// --- Helper to build service list XML ---
const buildServiceListXml = (services) => {
  if (Array.isArray(services)) {
    return services.map((s) => `<soap:ServiceList>${s}</soap:ServiceList>`).join("");
  }
  return `<soap:ServiceList>${services}</soap:ServiceList>`;
};

// --- Utility Functions ---

const escapeXml = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Cisco Control Center Services
 * This is a service class that uses fetch and promises to interact with the Cisco Control Center Services API
 *
 * @class controlCenterService
 * @param {string} host - The host to connect to. This is usually the IP address/FQDN of the CUCM publisher.
 * @param {string} username - The username to authenticate with. Can leave blank if using JSESSIONSSSO cookie.
 * @param {string} password - The password to authenticate with. Can leave blank if using JSESSIONSSSO cookie.
 * @param {object} options - Additional headers to add to the request. Useful for adding cookies for SSO sessions.
 * @param {boolean} retry - Enable or disable automatic retries (default: true).
 * @returns {object} returns constructor object.
 */
class controlCenterService {
  constructor(host, username, password, options = {}, retry = true) {
    this._OPTIONS = {
      retryOn: async function (attempt, error, response) {
        if (!retry) {
          return false;
        }
        if (attempt > (process.env.CCS_RETRY ? parseInt(process.env.CCS_RETRY) : 3)) {
          return false;
        }
        if (error !== null || (response && response.status >= 400)) {
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          await delay(process.env.CCS_RETRY_DELAY ? parseInt(process.env.CCS_RETRY_DELAY) : 5000);
          return true;
        }
      },
      method: "POST",
      headers: {
        Authorization: username && password ? "Basic " + Buffer.from(username + ":" + password).toString("base64") : "",
        "Content-Type": "text/xml;charset=UTF-8",
        Connection: "Keep-Alive",
      },
    };

    if (options) {
      this._OPTIONS.headers = Object.assign(this._OPTIONS.headers, options);
    }

    this._HOST = host;
    this._COOKIE = "";
  }

  /**
   * Get the current stored cookie
   * @memberof controlCenterService
   * @returns {string} returns the stored cookie string.
   */
  getCookie() {
    return this._COOKIE;
  }

  /**
   * Set a cookie to be used for subsequent requests
   * @memberof controlCenterService
   * @param {string} cookie - The cookie string to set.
   */
  setCookie(cookie) {
    this._COOKIE = cookie;
    this._OPTIONS.headers.Cookie = cookie;
  }

  /**
   * Internal method to make SOAP requests
   * @private
   */
  async _request(endpoint, soapAction, xml) {
    let options = { ...this._OPTIONS, headers: { ...this._OPTIONS.headers } };
    let soapBody = Buffer.from(xml);
    options.body = soapBody;
    options.SOAPAction = soapAction;

    let response = await fetch(`https://${this._HOST}:8443/controlcenterservice2/services/${endpoint}`, options);

    let cookie = response.headers.get("set-cookie") ? response.headers.get("set-cookie") : "";
    if (cookie) {
      this.setCookie(cookie);
    }

    let text = await response.text();
    let output = await parseXml(text);
    removeKeys(output, "$");

    if (!response.ok) {
      throw {
        status: response.status,
        code: http.STATUS_CODES[response.status],
        message: output?.Body?.Fault?.faultstring ? output.Body.Fault.faultstring : "Unknown",
      };
    }

    return { cookie, output };
  }

  // ===== Control Center Services =====

  /**
   * Lists all product and service information including ProductID, ServiceName, and DependentServices
   *
   * @memberof controlCenterService
   * @returns {object} returns JSON with cookie and results containing product/service information.
   */
  async getProductInformationList() {
    let xml = XML_GET_PRODUCT_INFORMATION_LIST();
    let { cookie, output } = await this._request("ControlCenterServices", "getProductInformationList", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.getProductInformationListResponse?.getProductInformationListReturn) {
      promiseResults.results = clean(output.Body.getProductInformationListResponse.getProductInformationListReturn);
    }

    return promiseResults;
  }

  /**
   * Get the status of services. Pass an empty string or no argument to get all services.
   *
   * @memberof controlCenterService
   * @param {string|string[]} [services] - Service name(s) to query. Empty/omit for all services.
   * @returns {object} returns JSON with cookie and results containing service status information.
   */
  async getServiceStatus(services = "") {
    let serviceStr = "";
    if (Array.isArray(services)) {
      serviceStr = services.map((s) => `<soap:ServiceName>${escapeXml(s)}</soap:ServiceName>`).join("");
    } else if (services) {
      serviceStr = `<soap:ServiceName>${escapeXml(services)}</soap:ServiceName>`;
    }

    let xml = XML_GET_SERVICE_STATUS(serviceStr);
    let { cookie, output } = await this._request("ControlCenterServices", "soapGetServiceStatus", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapGetServiceStatusResponse?.soapGetServiceStatusReturn) {
      let returnResults = output.Body.soapGetServiceStatusResponse.soapGetServiceStatusReturn;
      promiseResults.results = clean(returnResults);
    }

    return promiseResults;
  }

  /**
   * Get the static list of all services
   *
   * @memberof controlCenterService
   * @returns {object} returns JSON with cookie and results containing static service list.
   */
  async getStaticServiceList() {
    let xml = XML_GET_STATIC_SERVICE_LIST();
    let { cookie, output } = await this._request("ControlCenterServices", "soapGetStaticServiceList", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapGetStaticServiceListResponse?.soapGetStaticServiceListReturn) {
      promiseResults.results = clean(output.Body.soapGetStaticServiceListResponse.soapGetStaticServiceListReturn);
    }

    return promiseResults;
  }

  /**
   * Start, stop, or restart services
   *
   * @memberof controlCenterService
   * @param {string} nodeName - The local node name.
   * @param {string} controlType - The control action: "Start", "Stop", or "Restart".
   * @param {string|string[]} services - Service name(s) to control.
   * @returns {object} returns JSON with cookie and results containing service status after the operation.
   */
  async doControlServices(nodeName, controlType, services) {
    let serviceXml = buildServiceListXml(Array.isArray(services) ? services.map(escapeXml) : escapeXml(services));
    let xml = XML_DO_CONTROL_SERVICES(escapeXml(nodeName), escapeXml(controlType), serviceXml);
    let { cookie, output } = await this._request("ControlCenterServices", "soapDoControlServices", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapDoControlServicesResponse?.soapDoControlServicesReturn) {
      promiseResults.results = clean(output.Body.soapDoControlServicesResponse.soapDoControlServicesReturn);
    }

    return promiseResults;
  }

  /**
   * Deploy or undeploy a deployable service
   *
   * @memberof controlCenterService
   * @param {string} nodeName - The local node name.
   * @param {string} deployType - The deployment action: "Deploy" or "UnDeploy".
   * @param {string|string[]} services - Service name(s) to deploy/undeploy.
   * @returns {object} returns JSON with cookie and results containing service deployment status.
   */
  async doServiceDeployment(nodeName, deployType, services) {
    let serviceXml = buildServiceListXml(Array.isArray(services) ? services.map(escapeXml) : escapeXml(services));
    let xml = XML_DO_SERVICE_DEPLOYMENT(escapeXml(nodeName), escapeXml(deployType), serviceXml);
    let { cookie, output } = await this._request("ControlCenterServices", "soapDoServiceDeployment", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapDoServiceDeploymentResponse?.soapDoServiceDeploymentReturn) {
      promiseResults.results = clean(output.Body.soapDoServiceDeploymentResponse.soapDoServiceDeploymentReturn);
    }

    return promiseResults;
  }

  // ===== Control Center Services Extended =====

  /**
   * Lists the names of the files contained in the specified directory
   *
   * @memberof controlCenterService
   * @param {string} directoryPath - Full directory path (e.g., "/var/log/active/tomcat/logs/ccmservice").
   * @returns {object} returns JSON with cookie and results containing file directory listing.
   */
  async getFileDirectoryList(directoryPath) {
    let xml = XML_GET_FILE_DIRECTORY_LIST(escapeXml(directoryPath));
    let { cookie, output } = await this._request("ControlCenterServicesEx", "getFileDirectoryList", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.getFileDirectoryListResponse?.getFileDirectoryListReturn) {
      promiseResults.results = clean(output.Body.getFileDirectoryListResponse.getFileDirectoryListReturn);
    }

    return promiseResults;
  }

  /**
   * Get detailed static service list including ProductID and restrictions
   *
   * @memberof controlCenterService
   * @returns {object} returns JSON with cookie and results containing extended service list.
   */
  async getStaticServiceListExtended() {
    let xml = XML_GET_STATIC_SERVICE_LIST_EXTENDED();
    let { cookie, output } = await this._request("ControlCenterServicesEx", "getStaticServiceListExtended", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.getStaticServiceListExtendedResponse?.getStaticServiceListExtendedReturn) {
      promiseResults.results = clean(output.Body.getStaticServiceListExtendedResponse.getStaticServiceListExtendedReturn);
    }

    return promiseResults;
  }

  /**
   * Start, stop, or restart services (extended version for UCM and ELM 10.0+)
   *
   * @memberof controlCenterService
   * @param {string} productId - Product identifier: "CallManager", "Elm", or "Common".
   * @param {string} dependencyType - Dependency handling: "Enforce" or "None".
   * @param {string} controlType - The control action: "Start", "Stop", or "Restart".
   * @param {string|string[]} services - Service name(s) to control.
   * @returns {object} returns JSON with cookie and results containing service status after the operation.
   */
  async doControlServicesEx(productId, dependencyType, controlType, services) {
    let serviceXml = buildServiceListXml(Array.isArray(services) ? services.map(escapeXml) : escapeXml(services));
    let xml = XML_DO_CONTROL_SERVICES_EX(escapeXml(productId), escapeXml(dependencyType), escapeXml(controlType), serviceXml);
    let { cookie, output } = await this._request("ControlCenterServicesEx", "soapDoControlServicesEx", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapDoControlServicesExResponse?.soapDoControlServicesExReturn) {
      promiseResults.results = clean(output.Body.soapDoControlServicesExResponse.soapDoControlServicesExReturn);
    }

    return promiseResults;
  }

  /**
   * Deploy or undeploy a deployable service without database updates
   *
   * @memberof controlCenterService
   * @param {string} productId - Product identifier: "CallManager", "Elm", or "Common".
   * @param {string} deployType - The deployment action: "Deploy" or "UnDeploy".
   * @param {string|string[]} services - Service name(s) to deploy/undeploy.
   * @returns {object} returns JSON with cookie and results containing service deployment status.
   */
  async doServiceDeploymentNoDbUpdate(productId, deployType, services) {
    let serviceXml = buildServiceListXml(Array.isArray(services) ? services.map(escapeXml) : escapeXml(services));
    let xml = XML_DO_SERVICE_DEPLOYMENT_NO_DB_UPDATE(escapeXml(productId), escapeXml(deployType), serviceXml);
    let { cookie, output } = await this._request("ControlCenterServicesEx", "soapDoServiceDeploymentNoDbUpdate", xml);

    let promiseResults = { cookie, results: "" };

    if (output?.Body?.soapDoServiceDeploymentNoDbUpdateResponse?.soapDoServiceDeploymentNoDbUpdateReturn) {
      promiseResults.results = clean(output.Body.soapDoServiceDeploymentNoDbUpdateResponse.soapDoServiceDeploymentNoDbUpdateReturn);
    }

    return promiseResults;
  }
}

// --- Shared Utility Functions ---

const removeKeys = (obj, keys) => {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case "object":
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          } else {
            removeKeys(obj[prop], keys);
          }
          break;
        default:
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          }
          break;
      }
    }
  }
};

const clean = (object) => {
  if (Array.isArray(object)) {
    for (let i = object.length - 1; i >= 0; i--) {
      const v = object[i];
      if (v && typeof v === "object") {
        clean(v);
      }
      if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
        object.splice(i, 1);
      }
    }
  } else {
    Object.entries(object).forEach(([k, v]) => {
      if (v && typeof v === "object") {
        clean(v);
      }
      if ((v && typeof v === "object" && !Object.keys(v).length) || v === null || v === undefined) {
        delete object[k];
      }
    });
  }
  return object;
};

const parseXml = (xmlPart) => {
  return new Promise((resolve, reject) => {
    parseString(
      xmlPart,
      {
        explicitArray: false,
        explicitRoot: false,
        tagNameProcessors: [stripPrefix],
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

module.exports = controlCenterService;
