import { IsEmail, IsNumber, IsString } from 'class-validator';

export class UserDto {
  @IsNumber()
  id: number;

  @IsEmail()
  email?: string;

  @IsString()
  name?: string;

}
