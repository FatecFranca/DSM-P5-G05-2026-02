import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Perfil[]) => SetMetadata(ROLES_KEY, roles);
