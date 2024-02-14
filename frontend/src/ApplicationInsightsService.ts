import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

export const reactPlugin = new ReactPlugin();

export const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: 'ea103ae4-0caf-4f30-990a-0e046de2b8e6',
  },
});
appInsights.loadAppInsights();