import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Footer from '../../frontend/components/Footer';

// Wrapper component for routing
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Footer Component', () => {
  it('should render footer with all legal links', () => {
    render(
      <RouterWrapper>
        <Footer />
      </RouterWrapper>
    );

    // Check copyright text
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} MYCO Platform. All rights reserved.`)).toBeInTheDocument();

    // Check legal links
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('should have correct link destinations', () => {
    render(
      <RouterWrapper>
        <Footer />
      </RouterWrapper>
    );

    const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
    expect(termsLink).toHaveAttribute('href', '/terms');

    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink).toHaveAttribute('href', '/privacy');

    const supportLink = screen.getByRole('link', { name: 'Support' });
    expect(supportLink).toHaveAttribute('href', '/support');
  });

  it('should have proper styling classes', () => {
    render(
      <RouterWrapper>
        <Footer />
      </RouterWrapper>
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('border-t');
  });

  it('should be responsive', () => {
    render(
      <RouterWrapper>
        <Footer />
      </RouterWrapper>
    );

    // Check for responsive classes
    const container = screen.getByRole('contentinfo').querySelector('.container');
    expect(container).toHaveClass('mx-auto');
    
    const flexContainer = container?.querySelector('.flex');
    expect(flexContainer).toHaveClass('flex-col', 'md:flex-row');
  });
});