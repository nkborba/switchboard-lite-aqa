const { test, expect } = require('@playwright/test');

test('admin page loads', async ({ page }) => {
  await page.goto('/admin.html');
  await expect(page.getByRole('button', { name: 'Publish Lunch Menu' })).toBeVisible();
});

test('api publish is valid', async ({request}) => {
    const response = await request.post('/api/publish', {
        data : {
            name: 'Lunch Menu',
            items: [
                {
                    name: 'Grilled Chicken Salad',
                    price: 12.99
                }
            ]
        }
    })

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status, 'Status should be published').toBe('published');
    expect(body.name, 'Name should be Lunch Menu').toBe('Lunch Menu');
    expect(body, 'Version should be present').toHaveProperty('version');
})

test.only('api publish invalid scenarios', async ({request}) => {

    const response = await request.post('/api/publish', {
        data : {
            name: null,
            items: []
        }   
    })

    // const body = await response.json();

    expect(response.status()).toBe(400);

    // const responseInvalidEndpoint  = await request.post('/api/publishh', {})
})

