import React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import { useTranslation } from '../../utils/localization';
import styles from './SearchIndicator.module.css';

interface SearchIndicatorProps {
  isVisible: boolean;
}

export const SearchIndicator: React.FC<SearchIndicatorProps> = ({ isVisible }) => {
  const t = useTranslation();
  
  if (!isVisible) return null;
  
  return (
    <div className={styles.searchIndicator}>
      <Spinner size={SpinnerSize.xSmall} />
      <span className={styles.searchText}>
        {t('Searching Bing...')}
      </span>
    </div>
  );
};
