import type { Request } from 'express';
import type { StaffSession } from '../auth/auth.service';

export type StaffRequest = Request & {
  staffSession?: StaffSession;
  staffSessionId?: string;
};
