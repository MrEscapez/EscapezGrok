import type { Permission } from './permissions';

export type StaffRole = {
  id: string;
  name: string;
  permissions: Permission[];
};

export type StaffUserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  roleIds: string[];
};

export type RbacFileShape = {
  version: 1;
  roles: StaffRole[];
  users: StaffUserRecord[];
};

export type PublicStaffUser = {
  id: string;
  username: string;
  roleIds: string[];
  roles: Array<{ id: string; name: string }>;
  permissions: Permission[];
};
