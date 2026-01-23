import { test, expect } from '@playwright/test'

test.describe('merchant app journeys', () => {
  test('merchant login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Sign in to your account')).toBeVisible()
  })

  test('feed list shows recent runs', async ({ page }) => {
    await page.goto('/feed')
    await expect(page.getByTestId('feed-runs-table')).toBeVisible()
  })

  test('update feed configuration', async ({ page }) => {
    await page.goto('/feed')

    await page.getByTestId('feed-url-input').fill('https://e2e.example/feed.csv')
    await page.getByTestId('feed-test-connection').click()
    await expect(page.getByText('Successfully connected!')).toBeVisible()

    await page.getByTestId('feed-save-submit').click()
    await expect(page.locator('text=Failed to save feed configuration')).toHaveCount(0)
  })
})
