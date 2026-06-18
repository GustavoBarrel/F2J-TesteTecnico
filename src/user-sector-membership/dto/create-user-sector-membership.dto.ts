import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateUserSectorMembershipDto {
  @ApiProperty({ description: 'ID do usuário' })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'ID do cargo' })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  roleId: string;
}
