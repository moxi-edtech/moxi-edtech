import { test, expect } from '@playwright/test';

test.describe('API /api/financeiro', () => {
  test('should return the correct financial summary structure', async ({ request }) => {
    const response = await request.get('/api/financeiro');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    expect(data).toHaveProperty('inadimplencia');
    expect(data.inadimplencia).toHaveProperty('total');
    expect(data.inadimplencia).toHaveProperty('percentual');
    
    expect(data).toHaveProperty('risco');
    expect(data.risco).toHaveProperty('total');
    
    expect(data).toHaveProperty('confirmados');
    expect(data.confirmados).toHaveProperty('total');
    
    expect(data).toHaveProperty('pendentes');
    expect(data.pendentes).toHaveProperty('total');
  });
});
