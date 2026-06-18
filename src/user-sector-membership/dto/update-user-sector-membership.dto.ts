import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateUserSectorMembershipDto {
  @ApiProperty({ description: 'ID do cargo' })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  roleId: string;
}
