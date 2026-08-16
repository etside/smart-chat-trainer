import { test, expect } from '@playwright/test';

test.describe('Admin Console Accessibility and Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Session would be injected here in a real environment via LOVABLE_BROWSER_SUPABASE_SESSION_JSON
    await page.goto('http://localhost:8080/admin');
  });

  test('Mobile navigation buttons should be visible and accessible', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Check if mobile nav exists (the hidden-on-desktop sidebar will be gone, top-nav visible)
    const mobileNav = page.locator('nav.lg\\:hidden');
    await expect(mobileNav).toBeVisible();
    
    // Check for specific buttons like Dashboard, Training, etc.
    await expect(mobileNav.getByText('ড্যাশবোর্ড')).toBeVisible();
    
    // Verify high-contrast mode toggle works (if visible in mobile sidebar drawer/footer)
    // For now, check if the button is present in the main layout for mobile
  });

  test('Legal pages should be correctly wired and accessible to all roles', async ({ page }) => {
    // Desktop check
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const privacyLink = page.getByRole('link', { name: /Privacy Policy/i });
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();
    await expect(page.url()).toContain('/privacy');
    
    await page.goBack();
    
    const termsLink = page.getByRole('link', { name: /Terms of Service/i });
    await expect(termsLink).toBeVisible();
    await termsLink.click();
    await expect(page.url()).toContain('/terms');
  });
});
