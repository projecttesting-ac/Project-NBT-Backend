
import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

import { parsePhoneNumberFromString } from 'libphonenumber-js';

@ValidatorConstraint({
  name: 'isValidInternationalPhoneNumber',
  async: false,
})
class IsValidInternationalPhoneNumber
  implements ValidatorConstraintInterface
{
  validate(
    mobileNumber: unknown,
    args: ValidationArguments,
  ): boolean {
    if (
      typeof mobileNumber !== 'string' ||
      !/^\d{4,15}$/.test(mobileNumber)
    ) {
      return false;
    }

    const object = args.object as RegisterDto;

    if (
      typeof object.countryCode !== 'string' ||
      !/^\+[1-9]\d{0,2}$/.test(object.countryCode)
    ) {
      return false;
    }

    try {
      const phoneNumber = parsePhoneNumberFromString(
        `${object.countryCode}${mobileNumber}`,
      );

      return Boolean(
        phoneNumber &&
        phoneNumber.isValid() &&
        phoneNumber.countryCallingCode ===
          object.countryCode.slice(1),
      );
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Please enter a valid international mobile number.';
  }
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  @Validate(IsValidInternationalPhoneNumber)
  mobileNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  confirmPassword!: string;
}
