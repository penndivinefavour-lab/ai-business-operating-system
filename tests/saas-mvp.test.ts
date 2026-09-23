// tests/saas-mvp.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getDb } from '../src/db/client.ts';
import { migrate } from '../src/db/schema.ts';
import { hashPassword, verifyPassword } from '../src/auth.ts';
import {
  createAccount,
  findAccountByEmail,
  createBusiness,
  getBusinessBySlug,
  createMembership,
  getMembership,
  listMembershipsForAccount,
} from '../src/db/repositories.ts';

openDb();
const db = getDb();
try {
  db.exec('DELETE FROM business_memberships; DELETE FROM businesses; DELETE FROM accounts;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('accounts','businesses','business_memberships');");
} catch {}
migrate();

test('account: creates account with hashed password', () => {
  const email = 'owner_test@test.com';
  const passwordHash = hashPassword('secure-password-123');
  const accountId = createAccount(email, 'Test Owner', passwordHash);

  assert.ok(accountId > 0, 'Account ID should be positive');

  const account = findAccountByEmail(email);
  assert.ok(account, 'Account should be found');
  assert.equal(account.email, email);
});

test('account: verifyPassword works correctly', () => {
  const password = 'my-secure-password';
  const hash = hashPassword(password);
  assert.ok(verifyPassword(password, hash), 'Correct password should verify');
  assert.ok(!verifyPassword('wrong-password', hash), 'Wrong password should not verify');
});

test('account: duplicate email is rejected', () => {
  const email = 'dup_test@test.com';
  const passwordHash = hashPassword('password-123');
  createAccount(email, 'First User', passwordHash);

  assert.throws(
    () => createAccount(email, 'Second User', passwordHash),
    /UNIQUE constraint failed|SQLITE_CONSTRAINT/,
  );
});

test('business: creates a business with slug', () => {
  const slug = 'test_hotel';
  const businessId = createBusiness({
    slug,
    name: 'Hotel Test',
    city: 'Test City',
    country: 'Cameroon',
    business_type: 'hotel',
  });

  assert.ok(businessId > 0, 'Business ID should be positive');

  const business = getBusinessBySlug(slug);
  assert.ok(business, 'Business should be found');
  assert.equal(business.name, 'Hotel Test');
});

test('membership: links account to business', () => {
  const accountId = createAccount('mem_test@test.com', 'Membership User', hashPassword('password-123'));
  const businessId = createBusiness({ slug: 'mem_test_biz', name: 'Membership Test Business' });

  const membershipId = createMembership(accountId, businessId, 'owner');
  assert.ok(membershipId > 0, 'Membership ID should be positive');

  const membership = getMembership(accountId, businessId);
  assert.ok(membership, 'Membership should be found');
  assert.equal(membership.role, 'owner');
});

test('tenant isolation: cross-tenant access is denied', () => {
  const account1Id = createAccount('tenant1_test@test.com', 'Account 1', hashPassword('password-123'));
  const account2Id = createAccount('tenant2_test@test.com', 'Account 2', hashPassword('password-456'));
  const business1Id = createBusiness({ slug: 'tenant_biz_1', name: 'Business 1' });
  const business2Id = createBusiness({ slug: 'tenant_biz_2', name: 'Business 2' });

  createMembership(account1Id, business1Id, 'owner');
  createMembership(account2Id, business2Id, 'owner');

  // Account 1 should NOT have access to business 2
  const crossMembership = getMembership(account1Id, business2Id);
  assert.equal(crossMembership, undefined, 'Cross-tenant membership should not exist');

  // Account 2 should NOT have access to business 1
  const crossMembership2 = getMembership(account2Id, business1Id);
  assert.equal(crossMembership2, undefined, 'Cross-tenant membership should not exist');

  // Verify correct memberships still exist
  const membership1to1 = getMembership(account1Id, business1Id);
  assert.ok(membership1to1, 'Account 1 should have access to Business 1');
  assert.equal(membership1to1.role, 'owner');

  const membership2to2 = getMembership(account2Id, business2Id);
  assert.ok(membership2to2, 'Account 2 should have access to Business 2');
  assert.equal(membership2to2.role, 'owner');
});

test('list memberships for account returns all businesses', () => {
  const accountId = createAccount('list_test@test.com', 'List User', hashPassword('password'));
  const biz1 = createBusiness({ slug: 'list_biz_1', name: 'List Biz 1' });
  const biz2 = createBusiness({ slug: 'list_biz_2', name: 'List Biz 2' });

  createMembership(accountId, biz1, 'owner');
  createMembership(accountId, biz2, 'staff');

  const memberships = listMembershipsForAccount(accountId);
  assert.ok(memberships.length >= 2, `Should have at least 2 memberships, got ${memberships.length}`);

  const businessIds = memberships.map(m => m.business_id);
  assert.ok(businessIds.includes(biz1), 'Should include business 1');
  assert.ok(businessIds.includes(biz2), 'Should include business 2');
});
