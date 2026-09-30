import {
  IsIn,
} from 'class-validator';

export class UpdateGroupMemberRoleDto {
  @IsIn([
    'president',
    'vice_president',
    'moderator',
    'volunteer',
    'member',
  ])
  role!:
    | 'president'
    | 'vice_president'
    | 'moderator'
    | 'volunteer'
    | 'member';
}