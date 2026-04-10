import discoveryAcquisitionJson from "../../../config/discovery-acquisition.json";

export type DiscoveryAcquisition = typeof discoveryAcquisitionJson;

const discoveryAcquisition = discoveryAcquisitionJson as DiscoveryAcquisition;

export default discoveryAcquisition;
