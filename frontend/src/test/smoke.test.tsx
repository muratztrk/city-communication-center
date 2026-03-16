import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

describe('i18n smoke test', () => {
  it('renders localized loading text in Turkish by default', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <span>{i18n.t('common.loading')}</span>
      </I18nextProvider>,
    );

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });
});
