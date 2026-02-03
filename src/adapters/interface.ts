
export interface AdapterInterface<HostnameResponse> {
  createCustomHostname(hostname: string): Promise<HostnameResponse>;
  getCustomHostnameStatus(id: string): Promise<HostnameResponse>;
  deleteCustomHostname(id: string): Promise<void>;
}