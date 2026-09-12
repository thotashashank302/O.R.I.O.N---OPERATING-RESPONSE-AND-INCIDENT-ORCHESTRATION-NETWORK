import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);
const fixtureId = '11111111-1111-4111-a111-111111111111';
const fixture = { id: fixtureId, reporterId: 'synthetic', category: 'facilities', description: 'Synthetic browser regression', locationText: 'Test room', state: 'reported', version: 1, voteCount: 0, hasVoted: false, isConfidential: false, visibility: 'routine', createdAt: '2026-09-12T00:00:00Z' };
async function login(page: Page, role: 'student.aiml' | 'cr.aiml' | 'staff.electrician' | 'principal' = 'student.aiml') {
  const response = await page.request.post('/api/auth/login', { data: { email: `${role}@orion-demo.edu`, password: 'OrionDemo2026!' } });
  expect(response.ok()).toBeTruthy();
}

for (const role of ['student', 'cr'] as const) {
  test(`${role} feed distinguishes an outage from an empty feed and retries`, async ({ page }) => {
    await login(page, role === 'cr' ? 'cr.aiml' : 'student.aiml');
    let fail = true;
    await page.route('**/api/incidents', route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: { message: 'Synthetic feed outage' } } : { data: { incidents: [fixture] } } }));
    await page.goto(`/${role}`);
    await expect(page.locator('main [role=alert]')).toContainText('Synthetic feed outage');
    await expect(page.getByText('No incidents in this feed')).toHaveCount(0);
    await expect(page.getByText('No Repairs Awaiting CR Verification')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Retry feed' }).click();
    await expect(page.getByRole('heading', { name: fixture.description })).toBeVisible();
    await expect(page.locator('main [role=alert]')).toHaveCount(0);
  });
}

test('non-reporters see no reporter actions, and CR returns to its dashboard', async ({ page }) => {
  await login(page, 'cr.aiml');
  let state = 'submitted_for_verification';
  await page.route(`**/api/incidents/${fixtureId}`, route => route.fulfill({ json: { data: { incident: { ...fixture, state, isReporter: false, clarificationRequest: { question: 'Which room?' } } } } }));
  await page.goto(`/incidents/${fixtureId}`);
  await expect(page.getByRole('heading', { name: fixture.description })).toBeVisible();
  await expect(page.getByRole('button', { name: '✓ Confirm Repair' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reject & Reopen/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '← Back to Dashboard' })).toHaveAttribute('href', '/cr');
  state = 'needs_clarification'; await page.reload();
  await expect(page.getByRole('heading', { name: fixture.description })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Clarification' })).toHaveCount(0);
});

test('incident read retry clears the old error and confirmation failures stay inline', async ({ page }) => {
  await login(page);
  let fail = true; let submitted = 0; const dialogs: string[] = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.route(`**/api/incidents/${fixtureId}`, route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: { message: 'Synthetic detail outage' } } : { data: { incident: { ...fixture, state: 'submitted_for_verification', isReporter: true } } } }));
  await page.route(`**/api/incidents/${fixtureId}/confirm`, route => { submitted++; return route.fulfill({ status: 409, json: { error: { message: 'The task changed. Refresh before retrying.' } } }); });
  await page.goto(`/incidents/${fixtureId}`);
  await expect(page.getByRole('heading', { name: 'Unable to display incident' })).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Retry loading incident' }).click();
  await expect(page.getByRole('heading', { name: fixture.description })).toBeVisible();
  await page.getByRole('button', { name: /Reject & Reopen/ }).click();
  await expect(page.locator('main [role=alert]')).toContainText('at least 5 characters');
  expect(submitted).toBe(0);
  await page.getByRole('button', { name: '✓ Confirm Repair' }).click();
  await expect(page.locator('main [role=alert]')).toContainText('The task changed');
  await expect(page.getByRole('button', { name: '✓ Confirm Repair' })).toBeEnabled();
  expect(dialogs).toEqual([]);
});

test('acknowledgement recovers from network failure without an unhandled rejection', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let fail = true;
  await page.route('**/api/email-actions/acknowledge', route => fail ? route.abort('failed') : route.fulfill({ json: { data: {} } }));
  await page.goto('/email-actions/confirm?token=abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop');
  await page.getByRole('button', { name: 'Acknowledge assignment' }).click();
  await expect(page.getByText(/Unable to confirm the response/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge assignment' })).toBeEnabled();
  fail = false; await page.getByRole('button', { name: 'Acknowledge assignment' }).click();
  await expect(page.getByRole('button', { name: 'Acknowledged', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('vote failure remains visible and successful retry clears it', async ({ page }) => {
  await login(page); let fail = true;
  await page.route('**/api/incidents', route => route.fulfill({ json: { data: { incidents: [fixture] } } }));
  await page.route(`**/api/incidents/${fixtureId}/vote`, route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: { message: 'Synthetic vote outage' } } : { data: { voteCount: 1, hasVoted: true } } }));
  await page.goto('/student');
  const vote = page.getByRole('button', { name: /▲.*Vote/ });
  await vote.click(); await expect(page.locator('main [role=alert]')).toContainText('Synthetic vote outage');
  await expect(vote).toContainText('0');
  fail = false; await vote.click(); await expect(vote).toContainText('Voted');
  await expect(page.locator('main [role=alert]')).toHaveCount(0);
});

test('notification network failure is caught and remains retryable', async ({ page }) => {
  await login(page, 'staff.electrician');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/notifications', route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue());
  await page.goto('/staff');
  const markRead = page.getByRole('button', { name: 'Mark read', exact: true }).first();
  await expect(markRead).toBeVisible(); await markRead.click();
  await expect(page.locator('main [role=alert]')).toContainText('notification could not be updated');
  await expect(markRead).toBeEnabled(); expect(errors).toEqual([]);
});


test('handover opens inline and cancels without submitting an assignment action', async ({ page }) => {
  await login(page, 'staff.electrician'); let writes = 0;
  await page.route('**/api/assignments/*/actions', route => { writes++; return route.abort(); });
  await page.goto('/staff');
  const trigger = page.getByRole('button', { name: 'Request Handover', exact: true }).first();
  await trigger.click();
  await expect(page.getByRole('textbox', { name: 'Reason for handover' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Reason for handover' })).toHaveCount(0);
  await expect(trigger).toBeFocused(); expect(writes).toBe(0);
});

test('principal role dialog and setup tabs open without changing records', async ({ page }) => {
  await login(page, 'principal');
  await page.goto('/principal');
  await page.getByRole('button', { name: 'Manage Roles', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Manage Authorization Roles' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Locations', exact: true }).click();
  await expect(page.getByText('Label / Room Identifier', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manual Roster', exact: true }).click();
  await expect(page.getByText('Roll Number', { exact: true })).toBeVisible();
});
