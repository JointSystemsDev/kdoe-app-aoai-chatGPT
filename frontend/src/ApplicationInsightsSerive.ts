
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';
import { createContext, useContext } from 'react';
import { AppStateContext } from './state/AppProvider';

export const reactPlugin = new ReactPlugin();
export const AppInsightsContext = createContext<ApplicationInsights | undefined>(undefined);

export const initializeAppInsights = () => {
  const appStateContext = useContext(AppStateContext);
  
  if (!appStateContext?.state.frontendSettings?.ui?.appinsights_instrumentationkey) {
    console.error('Application Insights instrumentation key is not available');
    return undefined;
  }

  const appInsights = new ApplicationInsights({
    config: {
      instrumentationKey: appStateContext.state.frontendSettings.ui.appinsights_instrumentationkey,
      extensions: [reactPlugin],
    },
  });

  console.log('Application Insights instrumentation key is available and initialized');
  appInsights.loadAppInsights();
  return appInsights;
};

// Use this in a component or custom hook
export const useAppInsights = () => {
  return useContext(AppInsightsContext);
};