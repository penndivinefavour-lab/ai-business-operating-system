import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, closeDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import {
  createHotel,
  createEmployeeProfile,
  getEmployeeProfile,
  updateEmployeeProfile,
  createBusinessService,
  listBusinessServices,
  updateBusinessService,
  deleteBusinessService,
  createBusinessPolicy,
  listBusinessPolicies,
  updateBusinessPolicy,
  deleteBusinessPolicy,
  getOnboardingChecklist,
  initOnboardingChecklist,
  completeOnboardingStep,
  resetOnboardingStep,
} from '../src/db/repositories.ts';

openDb();
migrate();

// Use timestamp to avoid slug collisions with seeded demo
const ts = Date.now();

test('employee profile: create, read, update', () => {
  const hotelId = createHotel({
    slug: `emp-${ts}-1`,
    name: 'Employee Test Hotel',
    email: 'emp@test.com',
    phone: '+237600000001',
  });
  const emp = createEmployeeProfile(hotelId, {
    name: 'Marie',
    role: 'Concierge',
    avatar_emoji: '💁‍♀️',
    status: 'active',
  });
  assert.ok(emp > 0, 'employee profile created');

  const profile = getEmployeeProfile(hotelId);
  assert.ok(profile, 'employee profile exists');
  assert.equal(profile!.name, 'Marie');
  assert.equal(profile!.role, 'Concierge');
  assert.equal(profile!.avatar_emoji, '💁‍♀️');
  assert.equal(profile!.status, 'active');

  updateEmployeeProfile(hotelId, { name: 'Sophie', status: 'paused' });
  const updated = getEmployeeProfile(hotelId);
  assert.equal(updated!.name, 'Sophie');
  assert.equal(updated!.status, 'paused');
});

test('employee profile: tenant isolation', () => {
  const hotelA = createHotel({ slug: `iso-a-${ts}`, name: 'Hotel A' });
  const hotelB = createHotel({ slug: `iso-b-${ts}`, name: 'Hotel B' });
  createEmployeeProfile(hotelA, { name: 'Employee A', role: 'A' });
  createEmployeeProfile(hotelB, { name: 'Employee B', role: 'B' });

  const empA = getEmployeeProfile(hotelA);
  const empB = getEmployeeProfile(hotelB);
  assert.equal(empA!.name, 'Employee A');
  assert.equal(empB!.name, 'Employee B');
  assert.notEqual(empA!.name, empB!.name);
});

test('business services: CRUD', () => {
  const hotelId = createHotel({ slug: `svc-${ts}`, name: 'Service Hotel' });
  const id = createBusinessService(hotelId, {
    name: 'Breakfast',
    price: 5000,
    category: 'food',
  });
  assert.ok(id > 0, 'service created');

  const services = listBusinessServices(hotelId);
  assert.equal(services.length, 1);
  assert.equal(services[0]!.name, 'Breakfast');

  updateBusinessService(hotelId, id, { price: 7000 });
  const updated = listBusinessServices(hotelId);
  assert.equal(updated[0]!.price, 7000);

  deleteBusinessService(hotelId, id);
  const afterDelete = listBusinessServices(hotelId);
  assert.equal(afterDelete.length, 0);
});

test('business policies: CRUD', () => {
  const hotelId = createHotel({ slug: `pol-${ts}`, name: 'Policy Hotel' });
  const id = createBusinessPolicy(hotelId, {
    policy_type: 'cancellation',
    title: '48h cancellation',
    content: 'Free cancellation up to 48h before check-in.',
  });
  assert.ok(id > 0, 'policy created');

  const policies = listBusinessPolicies(hotelId);
  assert.equal(policies.length, 1);
  assert.equal(policies[0]!.title, '48h cancellation');

  updateBusinessPolicy(hotelId, id, { content: 'Updated content' });
  const updated = listBusinessPolicies(hotelId);
  assert.equal(updated[0]!.content, 'Updated content');

  deleteBusinessPolicy(hotelId, id);
  const afterDelete = listBusinessPolicies(hotelId);
  assert.equal(afterDelete.length, 0);
});

test('onboarding checklist: init, complete, reset', () => {
  const hotelId = createHotel({ slug: `onb-${ts}`, name: 'Onboarding Hotel' });
  initOnboardingChecklist(hotelId);
  const checklist = getOnboardingChecklist(hotelId);
  assert.ok(checklist.length > 0, 'checklist initialized');
  assert.equal(checklist.every(c => c.completed === 0), true);

  completeOnboardingStep(hotelId, 'business_info');
  const afterComplete = getOnboardingChecklist(hotelId);
  const bi = afterComplete.find(c => c.step_key === 'business_info');
  assert.equal(bi!.completed, 1);
  assert.ok(bi!.completed_at, 'completion timestamp set');

  resetOnboardingStep(hotelId, 'business_info');
  const afterReset = getOnboardingChecklist(hotelId);
  const bi2 = afterReset.find(c => c.step_key === 'business_info');
  assert.equal(bi2!.completed, 0);
  assert.equal(bi2!.completed_at, null);
});

test('tenant isolation: services and policies are per-hotel', () => {
  const h1 = createHotel({ slug: `iso-svc-a-${ts}`, name: 'Hotel 1' });
  const h2 = createHotel({ slug: `iso-svc-b-${ts}`, name: 'Hotel 2' });
  createBusinessService(h1, { name: 'WiFi', price: 0 });
  createBusinessService(h2, { name: 'Parking', price: 5000 });

  const s1 = listBusinessServices(h1);
  const s2 = listBusinessServices(h2);
  assert.equal(s1[0]!.name, 'WiFi');
  assert.equal(s2[0]!.name, 'Parking');
  assert.notEqual(s1[0]!.name, s2[0]!.name);
});

closeDb();
