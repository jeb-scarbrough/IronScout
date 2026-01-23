import { test, expect } from '@playwright/test'

test.describe('web app journeys', () => {
  test('auth sign-in page loads', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByText('Sign in to IronScout.ai')).toBeVisible()
  })

  test('search results show mock data', async ({ page }) => {
    await page.goto('/search?q=9mm')
    await expect(page.getByText('E2E 9mm FMJ 115gr (50 rd)')).toBeVisible()
    await expect(page.getByTestId('save-item-e2e-product-1')).toBeVisible()
  })

  test('save and remove a watchlist item', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept())

    await page.goto('/dashboard/saved')

    const existingRemoveButtons = page.locator('[data-testid^="saved-item-remove-"]')
    if ((await existingRemoveButtons.count()) > 0) {
      await existingRemoveButtons.first().click()
    }

    await page.goto('/search?q=9mm')
    await page.getByTestId('save-item-e2e-product-1').click()

    await page.goto('/dashboard/saved')
    await expect(page.locator('[data-testid^="saved-item-remove-"]').first()).toBeVisible()
  })
})
