import { test, expect } from '@playwright/test'

test.describe('admin app journeys', () => {
  test('admin sign-in page loads', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByText('Admin Portal')).toBeVisible()
  })

  test('merchants list loads with search input', async ({ page }) => {
    await page.goto('/merchants')
    await expect(page.getByTestId('merchant-list')).toBeVisible()
    await page.getByTestId('merchant-search-input').fill('E2E')
    await expect(page.getByTestId('merchant-search-input')).toHaveValue('E2E')
  })

  test('create and edit a merchant', async ({ page }) => {
    await page.goto('/merchants/create')

    await page.getByTestId('merchant-create-business-name').fill('E2E Test Outfitters')
    await page.getByTestId('merchant-create-website-url').fill('e2e-outfitters.example')
    await page.getByTestId('merchant-create-contact-first-name').fill('E2E')
    await page.getByTestId('merchant-create-contact-last-name').fill('Tester')
    await page.getByTestId('merchant-create-submit').click()

    await expect(page).toHaveURL(/\/merchants\/e2e-merchant/)
    await expect(page.getByText('Merchant ID: e2e-merchant')).toBeVisible()

    await page.getByTestId('merchant-edit-open').click()
    await page.locator('#businessName').fill('E2E Updated Outfitters')
    await page.getByTestId('merchant-edit-submit').click()

    await expect(page.getByTestId('merchant-edit-open')).toBeVisible()
  })
})
