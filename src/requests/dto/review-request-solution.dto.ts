import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ReviewRequestSolutionDto {
  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({
    description:
      'true = aprovar solução (status vai para COMPLETED); false = rejeitar (status volta para IN_PROGRESS)',
  })
  approved: boolean;
}
