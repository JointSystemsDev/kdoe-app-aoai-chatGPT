import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { initializeIcons } from '@fluentui/react'

import Chat from './pages/chat/Chat'
import Layout from './pages/layout/Layout'
import NoPage from './pages/NoPage'
import { AppStateProvider } from './state/AppProvider'
import { EnvironmentProvider } from './state/EnvironmentProvider'
import { AppInsightsContext, initializeAppInsights } from './ApplicationInsightsSerive'

import './index.css'

initializeIcons()

export default function App() {
  return (
    <EnvironmentProvider>
      <AppStateProvider>
        <AppInsightsInitializer>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Chat />} />
                <Route path="*" element={<NoPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </AppInsightsInitializer>
      </AppStateProvider>
    </EnvironmentProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
)

const AppInsightsInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appInsights = initializeAppInsights();

  return (
    <AppInsightsContext.Provider value={appInsights}>
      {children}
    </AppInsightsContext.Provider>
  );
};