import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizePhoneNumber(
  countryCode: string,
  mobileNumber: string,
): string {
  const cleanCountryCode =
    String(countryCode || '').trim();

  let cleanMobileNumber =
    String(mobileNumber || '')
      .trim()
      .replace(/\s+/g, '');

  if (!/^\+[1-9]\d{0,3}$/.test(cleanCountryCode)) {
    throw new BadRequestException(
      'Please select a valid country code.',
    );
  }

  if (!/^\d{4,15}$/.test(cleanMobileNumber)) {
    throw new BadRequestException(
      'Please enter a valid mobile number.',
    );
  }

  // Allow users to enter the common national format
  // with a leading zero.
  cleanMobileNumber =
    cleanMobileNumber.replace(/^0+/, '');

  if (!cleanMobileNumber) {
    throw new BadRequestException(
      'Please enter a valid mobile number.',
    );
  }

  const fullNumber =
    `${cleanCountryCode}${cleanMobileNumber}`;

  const phoneNumber =
    parsePhoneNumberFromString(fullNumber);

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new BadRequestException(
      'Please enter a valid mobile number.',
    );
  }

  return phoneNumber.number;
}