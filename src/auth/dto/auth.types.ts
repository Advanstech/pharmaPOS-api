import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { User } from '../entities/user.entity';

@InputType({ description: 'Credentials for authenticating an existing user' })
export class LoginInput {
  @Field({ description: 'Registered email address' })
  @IsEmail()
  email!: string;

  @Field({ description: 'Account password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;
}

@InputType({ description: 'Register a new user account within a branch' })
export class RegisterInput {
  @Field({ description: 'UUID of the branch this user belongs to' })
  @IsString()
  branch_id!: string;

  @Field({ description: 'Full display name of the user' })
  @IsString()
  name!: string;

  @Field({ description: 'Unique email address — used as login identifier' })
  @IsEmail()
  email!: string;

  @Field({ description: 'Password — minimum 8 characters. Stored as bcrypt hash (cost 12).' })
  @IsString()
  @MinLength(8)
  password!: string;

  @Field({
    description:
      'Role assigned to this user. Valid values: `owner` | `head_pharmacist` | `pharmacist` | `cashier` | `manager` | `se_admin`',
  })
  @IsString()
  role!: string;
}

@ObjectType({
  description:
    'Returned on successful login, register, or token refresh. ' +
    'Store `access_token` in memory (never localStorage). ' +
    'Store `refresh_token` in an httpOnly cookie.',
})
export class AuthPayload {
  @Field({
    description:
      'Short-lived JWT access token. Valid for **15 minutes**. ' +
      'Include as `Authorization: Bearer <token>` on every GraphQL request.',
  })
  access_token!: string;

  @Field({
    description:
      'Long-lived refresh token. Valid for **30 days**. ' +
      'Use with the `refreshToken` mutation to obtain a new access token. ' +
      'Invalidated on logout.',
  })
  refresh_token!: string;

  @Field({
    description: 'Access token lifetime in seconds. Always `900` (15 minutes).',
  })
  expires_in!: number;

  @Field(() => User, { description: 'Authenticated user profile' })
  user!: User;
}
