export interface ServiceabilityOptions {
  Cookie?: string;
  [key: string]: string | undefined;
}

export interface ServiceabilityResult {
  cookie: string;
  results: any;
}

export interface ServiceInfo {
  ServiceName: string;
  ServiceStatus: string;
  ReasonCode: string;
  ReasonCodeString: string;
  StartTime?: string;
  UpTime?: string;
}

export interface ServiceStatusResult {
  ReturnCode: string;
  ReasonCode?: string;
  ReasonString?: string;
  ServiceInfoList: ServiceInfo | ServiceInfo[];
}

export interface ProductInfo {
  ProductName: string;
  ProductVersion: string;
  ProductDescription: string;
  ProductID: string;
  ShortName: string;
}

export interface StaticServiceInfo {
  ServiceName: string;
  ServiceType: string;
  Deployable: string;
  GroupName: string;
  DependentServices?: string;
}

export interface ExtendedServiceInfo extends StaticServiceInfo {
  ProductID: string;
  RestrictServer?: string;
  Restrict?: string;
  SetDefault?: string;
  SequenceNumber?: string;
  ServiceEnum?: string;
}

export interface ProductInformationResult {
  ActiveServerVersion?: string;
  PrimaryNode?: string;
  SecondaryNode?: string;
  Products?: ProductInfo | ProductInfo[];
  Services?: StaticServiceInfo | StaticServiceInfo[];
}

declare class controlCenterService {
  constructor(
    host: string,
    username: string,
    password: string,
    options?: ServiceabilityOptions,
    retry?: boolean
  );

  /**
   * Get the current stored cookie
   */
  getCookie(): string;

  /**
   * Set a cookie to be used for subsequent requests
   */
  setCookie(cookie: string): void;

  /**
   * Lists all product and service information
   */
  getProductInformationList(): Promise<{
    cookie: string;
    results: ProductInformationResult | string;
  }>;

  /**
   * Get the status of services
   */
  getServiceStatus(
    services?: string | string[]
  ): Promise<{
    cookie: string;
    results: ServiceStatusResult | string;
  }>;

  /**
   * Get the static list of all services
   */
  getStaticServiceList(): Promise<{
    cookie: string;
    results: StaticServiceInfo[] | string;
  }>;

  /**
   * Start, stop, or restart services
   */
  doControlServices(
    nodeName: string,
    controlType: "Start" | "Stop" | "Restart",
    services: string | string[]
  ): Promise<{
    cookie: string;
    results: ServiceStatusResult | string;
  }>;

  /**
   * Deploy or undeploy a deployable service
   */
  doServiceDeployment(
    nodeName: string,
    deployType: "Deploy" | "UnDeploy",
    services: string | string[]
  ): Promise<{
    cookie: string;
    results: ServiceStatusResult | string;
  }>;

  /**
   * Lists the names of files in the specified directory
   */
  getFileDirectoryList(
    directoryPath: string
  ): Promise<{
    cookie: string;
    results: any;
  }>;

  /**
   * Get detailed static service list including ProductID and restrictions
   */
  getStaticServiceListExtended(): Promise<{
    cookie: string;
    results: ExtendedServiceInfo[] | string;
  }>;

  /**
   * Start, stop, or restart services (extended version for UCM and ELM 10.0+)
   */
  doControlServicesEx(
    productId: "CallManager" | "Elm" | "Common",
    dependencyType: "Enforce" | "None",
    controlType: "Start" | "Stop" | "Restart",
    services: string | string[]
  ): Promise<{
    cookie: string;
    results: ServiceStatusResult | string;
  }>;

  /**
   * Deploy or undeploy a deployable service without database updates
   */
  doServiceDeploymentNoDbUpdate(
    productId: "CallManager" | "Elm" | "Common",
    deployType: "Deploy" | "UnDeploy",
    services: string | string[]
  ): Promise<{
    cookie: string;
    results: ServiceStatusResult | string;
  }>;
}

export = controlCenterService;
