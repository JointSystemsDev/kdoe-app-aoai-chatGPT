import React, { useState, useContext } from 'react';
import { Dropdown, IDropdownOption, Spinner, SpinnerSize, MessageBar, MessageBarType } from '@fluentui/react';
import { useEnvironment } from '../../state/EnvironmentProvider';
import { AppStateContext } from '../../state/AppProvider';
import styles from './EnvironmentSelector.module.css';
import { EnvironmentSwitchDialog } from '../Environment/EnvironmentSwitchDialog';

export const EnvironmentSelector: React.FC = () => {
  const { environments, selectedEnvironment, setSelectedEnvironment, isLoading, error } = useEnvironment();
  const appStateContext = useContext(AppStateContext);
  const [pendingEnvironment, setPendingEnvironment] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const hasActiveChat = appStateContext?.state.currentChat !== null;

  const handleEnvironmentChange = (_event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
    if (!option) return;
    
    const newEnvironmentId = option.key as string;
    
    if (hasActiveChat) {
      setPendingEnvironment(newEnvironmentId);
      setIsDialogOpen(true);
    } else {
      executeEnvironmentSwitch(newEnvironmentId);
    }
  };

  const executeEnvironmentSwitch = async (newEnvironmentId: string) => {
    setIsTransitioning(true);
    
    // Start fade out
    const selectorElement = document.querySelector(`.${styles.environmentSelector}`);
    if (selectorElement) {
      selectorElement.classList.add(styles.fadeOut);
    }

    // Wait for fade out animation
    await new Promise(resolve => setTimeout(resolve, 300));

    // Execute the switch
    setSelectedEnvironment(newEnvironmentId);

    // Wait a bit to let the new environment load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start fade in
    if (selectorElement) {
      selectorElement.classList.remove(styles.fadeOut);
      selectorElement.classList.add(styles.fadeIn);
    }

    // Clean up
    setTimeout(() => {
      if (selectorElement) {
        selectorElement.classList.remove(styles.fadeIn);
      }
      setIsTransitioning(false); // Fixed: was incorrectly set to true
    }, 300);
  };

  const handleConfirmSwitch = () => {
    if (pendingEnvironment) {
      executeEnvironmentSwitch(pendingEnvironment);
      setPendingEnvironment(null);
    }
    setIsDialogOpen(false);
  };

  const handleDismissDialog = () => {
    setPendingEnvironment(null);
    setIsDialogOpen(false);
  };

  const options: IDropdownOption[] = environments.map(env => ({
    key: env.id,
    text: env.name,
  }));

  if (isLoading) {
    return (
      <div className={styles.spinnerContainer}>
        <Spinner size={SpinnerSize.small} label="Loading environments..." />
      </div>
    );
  }

  if (error) {
    return (
      <MessageBar
        messageBarType={MessageBarType.error}
        isMultiline={false}
        dismissButtonAriaLabel="Close"
      >
        {error}
      </MessageBar>
    );
  }

  const currentEnvName = environments.find(env => env.id === selectedEnvironment)?.name;
  const pendingEnvName = environments.find(env => env.id === pendingEnvironment)?.name;

  return (
    <>
      <div className={`${styles.environmentSelector} ${isTransitioning ? styles.transitioning : ''}`}>
        <Dropdown
          className={styles.dropdown}
          placeholder="Select an environment"
          options={options}
          selectedKey={selectedEnvironment}
          onChange={handleEnvironmentChange}
          disabled={isLoading || isTransitioning}
        />
      </div>
      <EnvironmentSwitchDialog
        isOpen={isDialogOpen}
        onConfirm={handleConfirmSwitch}
        onDismiss={handleDismissDialog}
        fromEnvironment={currentEnvName || ''}
        toEnvironment={pendingEnvName || ''}
      />
    </>
  );
};