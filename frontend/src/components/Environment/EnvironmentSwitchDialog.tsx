import React from 'react';
import { Dialog, DialogType, DialogFooter, PrimaryButton, DefaultButton } from '@fluentui/react';

interface EnvironmentSwitchDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  fromEnvironment: string;
  toEnvironment: string;
}

export const EnvironmentSwitchDialog: React.FC<EnvironmentSwitchDialogProps> = ({
  isOpen,
  onConfirm,
  onDismiss,
  fromEnvironment,
  toEnvironment
}) => {
  const dialogContentProps = {
    type: DialogType.normal,
    title: 'Switch Environment?',
    closeButtonAriaLabel: 'Close',
    subText: `You have an active chat in "${fromEnvironment}". Switching to "${toEnvironment}" will start a new chat. Do you want to continue?`
  };

  const modalProps = {
    isBlocking: true,
    styles: { main: { maxWidth: 450 } }
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={dialogContentProps}
      modalProps={modalProps}
    >
      <DialogFooter>
        <PrimaryButton onClick={onConfirm} text="Switch" />
        <DefaultButton onClick={onDismiss} text="Cancel" />
      </DialogFooter>
    </Dialog>
  );
};