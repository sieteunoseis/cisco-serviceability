const controlCenterService = require("../main");
const path = require("path");
const { cleanEnv, str, host } = require("envalid");

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_SERVER_NAME: str({ desc: "The CUCM node name.", example: "hq-cucm-pub" }),
});

let service = new controlCenterService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD, {}, false);

var cucmServerName = env.CUCM_SERVER_NAME;

(async () => {
  console.log("--- getProductInformationList ---");
  await service
    .getProductInformationList()
    .then((response) => {
      console.log("Product Information:", JSON.stringify(response.results, null, 2));
      if (response.cookie) {
        service = new controlCenterService(env.CUCM_HOSTNAME, "", "", { Cookie: response.cookie });
      }
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });

  console.log("\n--- getServiceStatus (all services) ---");
  await service
    .getServiceStatus()
    .then((response) => {
      console.log("Service Status:", JSON.stringify(response.results, null, 2));
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });

  console.log("\n--- getServiceStatus (specific service) ---");
  await service
    .getServiceStatus("Cisco CallManager")
    .then((response) => {
      console.log("CallManager Status:", JSON.stringify(response.results, null, 2));
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });

  console.log("\n--- getStaticServiceList ---");
  await service
    .getStaticServiceList()
    .then((response) => {
      console.log("Static Service List:", JSON.stringify(response.results, null, 2));
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });

  console.log("\n--- getStaticServiceListExtended ---");
  await service
    .getStaticServiceListExtended()
    .then((response) => {
      console.log("Extended Service List:", JSON.stringify(response.results, null, 2));
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });

  console.log("\n--- getFileDirectoryList ---");
  await service
    .getFileDirectoryList("/var/log/active/tomcat/logs/ccmservice")
    .then((response) => {
      console.log("File Directory:", JSON.stringify(response.results, null, 2));
    })
    .catch((error) => {
      console.log("Error:", JSON.stringify(error));
    });
})();
