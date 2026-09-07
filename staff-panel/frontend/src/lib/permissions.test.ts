import { describe, expect, it } from 'vitest';
import { can, canAll, canAny, PERMISSIONS } from './permissions';

describe('can()', () => {
  it('returns false for empty/undefined permissions', () => {
    expect(can(undefined, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(can(null, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(can([], PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('returns true when permission is present', () => {
    expect(
      can(['dashboard:view', 'settings:manage'], PERMISSIONS.SETTINGS_MANAGE),
    ).toBe(true);
  });

  it('returns false when permission is missing (helper case)', () => {
    const helper = ['dashboard:view', 'players:view', 'reports:view', 'tickets:view'];
    expect(can(helper, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(can(helper, PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
  });

  it('canAny / canAll helpers', () => {
    const perms = ['settings:view'];
    expect(canAny(perms, ['settings:manage', 'settings:view'])).toBe(true);
    expect(canAll(perms, ['settings:view', 'settings:manage'])).toBe(false);
  });
});
