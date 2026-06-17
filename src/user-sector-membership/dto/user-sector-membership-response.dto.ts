import { ApiProperty } from "@nestjs/swagger";

export class UserSectorMembershipResponseDto {
    @ApiProperty({ description: 'ID da membership', example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;
    @ApiProperty({ description: 'ID do usuário', example: '123e4567-e89b-12d3-a456-426614174001' })
    userId: string;
    @ApiProperty({ description: 'ID do setor', example: '123e4567-e89b-12d3-a456-426614174002' })
    sectorId: string;
    @ApiProperty({ description: 'ID do cargo', example: '123e4567-e89b-12d3-a456-426614174003' })
    roleId: string;
}
