import ReactDOM from 'react-dom/client'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { initializeIcons } from '@fluentui/react'

import Chat from './pages/chat/Chat'
import Layout from './pages/layout/Layout'
import NoPage from './pages/NoPage'
import { AppStateProvider } from './state/AppProvider'
import { EnvironmentProvider } from './state/EnvironmentProvider'
import { useContext, useEffect } from 'react'
import { AppStateContext } from './state/AppProvider'

import './index.css'
import ConfigurationPage from './components/Environment/ConfigurationPage'

initializeIcons()

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appStateContext = useContext(AppStateContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!appStateContext?.state.frontendSettings?.userInfo?.isAdmin && !appStateContext?.state.frontendSettings?.userInfo?.isPowerUser) {
      navigate('/');
    }
  }, [appStateContext?.state.frontendSettings?.userInfo]);

  return <>{children}</>;
};

export default function App() {
  return (
    <EnvironmentProvider>
      <AppStateProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Chat />} />
              <Route
                  path="configuration"
                  element={
                    <ProtectedRoute>
                      <ConfigurationPage />
                    </ProtectedRoute>
                  }
                />
              <Route path="*" element={<NoPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppStateProvider>
    </EnvironmentProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
)
