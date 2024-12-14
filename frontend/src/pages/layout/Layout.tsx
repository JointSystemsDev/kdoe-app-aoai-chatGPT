import { useContext, useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Dialog, Stack, TextField } from '@fluentui/react'
import { CopyRegular } from '@fluentui/react-icons'

import { CosmosDBStatus } from '../../api'
import Contoso from '../../assets/Contoso.svg'
import { HistoryButton, ShareButton } from '../../components/common/Button'
import { AppStateContext } from '../../state/AppProvider'

import styles from './Layout.module.css'

import { t } from '../../utils/localization';
import { EnvironmentSelector } from '../../components/common/EnvironmentSelector'
import { useEnvironment } from '../../state/EnvironmentProvider'

const Layout = () => {
  const [isSharePanelOpen, setIsSharePanelOpen] = useState<boolean>(false)
  const [copyClicked, setCopyClicked] = useState<boolean>(false)
  const [copyText, setCopyText] = useState<string>('Copy URL')
  const [shareLabel, setShareLabel] = useState<string | undefined>('Share')
  // const [hideHistoryLabel, setHideHistoryLabel] = useState<string>('Hide chat history')
  // const [showHistoryLabel, setShowHistoryLabel] = useState<string>('Show chat history')
  const [logo, setLogo] = useState('')
  const appStateContext = useContext(AppStateContext)
  const { selectedEnvironment } = useEnvironment()
  const ui = appStateContext?.state.frontendSettings?.ui

  const handleShareClick = () => {
    setIsSharePanelOpen(true)
  }

  const handleSharePanelDismiss = () => {
    setIsSharePanelOpen(false)
    setCopyClicked(false)
    setCopyText('Copy URL')
  }

  const handleCopyClick = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopyClicked(true)
  }

  const handleHistoryClick = () => {
    appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' })
  }

  const getPageTitle = () => {
    if (location.pathname === '/configuration') {
      return 'Configuration Management'
    }
    return ui?.title || 'Chatbot'
  }

  useEffect(() => {
    const title = getPageTitle();
    document.title = title;
  }, [location.pathname, ui?.title, selectedEnvironment]);

  // Function to process logo URL
  const processLogoUrl = (logoPath: string | null | undefined) => {
    if (!logoPath) return Contoso;
    if (logoPath.startsWith('http') || logoPath.startsWith('data:')) {
      return logoPath;
    }
    // Handle relative paths - you might need to adjust this based on your setup
    return logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
  }

  useEffect(() => {
    if (!appStateContext?.state.isLoading) {
      const logoUrl = processLogoUrl(ui?.logo);
      setLogo(logoUrl);
    }
  }, [appStateContext?.state.isLoading, ui?.logo, selectedEnvironment]);

  useEffect(() => {
    if (!appStateContext?.state.isLoading) {
      setLogo(ui?.logo || Contoso)
    }
  }, [appStateContext?.state.isLoading])

  useEffect(() => {
    if (copyClicked) {
      setCopyText('Copied URL')
    }
  }, [copyClicked])

  useEffect(() => { }, [appStateContext?.state.isCosmosDBAvailable.status])

  // useEffect(() => {
  //   const handleResize = () => {
  //     if (window.innerWidth < 480) {
  //       setShareLabel(undefined)
  //       setHideHistoryLabel(t('Hide history'))
  //       setShowHistoryLabel(t('Show history'))
  //     } else {
  //       setShareLabel(t('Share'))
  //       setHideHistoryLabel(t('Hide chat history'))
  //       setShowHistoryLabel(t('Show chat history'))
  //     }
  //   }
    // window.addEventListener('resize', handleResize)
    // handleResize()
  //   return () => window.removeEventListener('resize', handleResize)
  // }, [])

  return (
    <div className={styles.layout}>
      <header className={styles.header} role={'banner'}>
        <Stack horizontal verticalAlign="center" horizontalAlign="space-between">
          <Stack horizontal verticalAlign="center">
            <img src={logo} className={styles.headerIcon} aria-hidden="true" alt="" onError={() => setLogo(Contoso)} />
            <Link to="/" className={styles.headerTitleContainer}>
              <h1 className={styles.headerTitle}>{ui?.title}</h1>
            </Link>
            {
              ui?.additional_header_logo && (
                <img src={ui?.additional_header_logo} className={styles.headerIcon} aria-hidden="true" alt="" />
            )}
             {
              ui?.help_link_title && ui.help_link_url && (
                <Link to={ui.help_link_url} target="_blank" className={styles.headerTitleContainer}>
                  <h1 className={styles.headerTitle}>{ui?.help_link_title}</h1>
                </Link>
            )}
            {(appStateContext?.state.userInfo?.isAdmin || appStateContext?.state.userInfo?.isPowerUser) && (
              <Link to="/configuration" className={styles.configLink}>
                Configuration
              </Link>
            )}
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 4 }} className={styles.shareButtonContainer}>
            {
              ui?.enable_mode_selector && (
                <EnvironmentSelector />
              )
            }
            {appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && ui?.show_chat_history_button !== false && (
              <HistoryButton
                onClick={handleHistoryClick}
                text={appStateContext?.state?.isChatHistoryOpen ? t('Hide chat history') : t('Show chat history')}
              />
            )}
            {ui?.show_share_button && <ShareButton onClick={handleShareClick} text={shareLabel} />}
          </Stack>
        </Stack>
      </header>
      <Outlet />
      <Dialog
        onDismiss={handleSharePanelDismiss}
        hidden={!isSharePanelOpen}
        styles={{
          main: [
            {
              selectors: {
                ['@media (min-width: 480px)']: {
                  maxWidth: '600px',
                  background: '#FFFFFF',
                  boxShadow: '0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  maxHeight: '200px',
                  minHeight: '100px'
                }
              }
            }
          ]
        }}
        dialogContentProps={{
          title: 'Share the web app',
          showCloseButton: true
        }}>
        <Stack horizontal verticalAlign="center" style={{ gap: '8px' }}>
          <TextField className={styles.urlTextBox} defaultValue={window.location.href} readOnly />
          <div
            className={styles.copyButtonContainer}
            role="button"
            tabIndex={0}
            aria-label="Copy"
            onClick={handleCopyClick}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? handleCopyClick() : null)}>
            <CopyRegular className={styles.copyButton} />
            <span className={styles.copyButtonText}>{copyText}</span>
          </div>
        </Stack>
      </Dialog>
    </div>
  )
}

export default Layout
