import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Gebruikersnaam is verplicht' })
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Wachtwoord is verplicht' })
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
