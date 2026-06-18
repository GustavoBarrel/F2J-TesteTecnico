import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignRequestDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @ApiProperty({
    type: [String],
    description: 'IDs dos usuários a serem atribuídos. Substitui a lista atual.',
    example: ['uuid1', 'uuid2'],
  })
  userIds: string[];
}

export class SetObserversDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @ApiProperty({
    type: [String],
    description: 'IDs dos usuários observadores. Substitui a lista atual.',
    example: ['uuid1', 'uuid2'],
  })
  userIds: string[];
}
