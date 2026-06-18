import { ApiProperty } from "@nestjs/swagger";
import { SectorServiceResponseDto } from "src/sector-services/dto/sector-service-response.dto";
import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class FindServiceOptionsResponseDto {
    @ApiProperty({
        description: 'O ID do Setor',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    id: string;

    @ApiProperty({
        description: 'O Nome do Setor',
        example: 'TI',
    })
    @IsString()
    name: string;

    @ApiProperty({
        description: 'Os Serviços do Setor',
        type: () => SectorServiceResponseDto,
        isArray: true,
    })
    @IsArray()
    @IsNotEmpty()
    sectorServices: SectorServiceResponseDto[];
}