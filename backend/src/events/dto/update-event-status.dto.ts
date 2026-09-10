import { IsIn } from 'class-validator';

export class UpdateEventStatusDto {
  @IsIn(['draft', 'published'])
  status!: 'draft' | 'published';
}