import { test, expect } from '@playwright/test'

test.describe('web app journeys', () => {
  test('auth sign-in page loads', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByText('Sign in to IronScout')).toBeVisible()
  })

  test('search results show mock data', async ({ page }) => {
    await page.goto('/search?q=9mm')
    await expect(page.getByText('E2E 9mm FMJ 115gr (50 rd)')).toBeVisible()
    await expect(page.getByRole('button', { name: /watchlist/i }).first()).toBeVisible()
  })

  test('save and remove a watchlist item', async ({ page }) => {
    await page.goto('/search?q=9mm')
    const watchButton = page.getByRole('button', { name: /watchlist/i }).first()
    await expect(watchButton).toBeVisible()

    await watchButton.click()
    await expect(page.getByText(/Added to watchlist|Removed from watchlist/)).toBeVisible()
  })
})
