import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

export const reactPlugin = new ReactPlugin();

export const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: '52fee5be-4389-4ad0-87da-632a8415df13',
  },
});
appInsights.loadAppInsights();