import primaryMarketingData from "../../../config/primary-marketing.json";

export type PrimaryMarketing = typeof primaryMarketingData;

const primaryMarketing = primaryMarketingData as PrimaryMarketing;

export default primaryMarketing;
