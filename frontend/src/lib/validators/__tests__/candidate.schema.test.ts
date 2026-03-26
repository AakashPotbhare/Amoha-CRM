import { describe, it, expect } from 'vitest';
import { candidateEnrollmentSchema } from '@/lib/validators/candidate.schema';

// Minimal valid payload — only the fields that are actually required (not optional)
const validBase = {
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '5551234',
  technology: 'Java',
};

describe('candidateEnrollmentSchema', () => {
  describe('valid data', () => {
    it('accepts a minimal valid payload', () => {
      const result = candidateEnrollmentSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('accepts a fully-populated payload', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        dob: '1990-01-15',
        gender: 'female',
        ssn_last4: '1234',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        linkedin_email: 'jane@linkedin.com',
        linkedin_password: 'secret',
        visa_status: 'opt',
        visa_expiry: '2025-12-31',
        visa_type: 'F1',
        highest_qualification: 'Masters',
        bachelors_university: 'MIT',
        bachelors_gpa: '3.8',
        bachelors_year: '2012',
        bachelors_country: 'USA',
        masters_university: 'Stanford',
        masters_gpa: '3.9',
        masters_year: '2014',
        masters_country: 'USA',
        years_experience: 5,
        security_clearance: 'None',
        is_veteran: false,
        current_city: 'New York',
        current_state: 'NY',
        current_zip: '10001',
        willing_to_relocate: true,
        preferred_locations: 'Remote',
        available_from: '2024-03-01',
        work_hours_preference: 'Morning',
        work_authorization: 'OPT',
        expected_rate: 85,
        pay_type: 'w2',
      });
      expect(result.success).toBe(true);
    });

    it('accepts ssn_last4 as empty string', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        ssn_last4: '',
      });
      expect(result.success).toBe(true);
    });

    it('accepts ssn_last4 as exactly 4 characters', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        ssn_last4: '9876',
      });
      expect(result.success).toBe(true);
    });

    it('accepts ssn_last4 as undefined (optional)', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        ssn_last4: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid visa_status values', () => {
      const statuses = ['h1b', 'opt', 'cpt', 'h4_ead', 'l2_ead', 'gc', 'gc_ead', 'citizen', 'other'] as const;
      statuses.forEach((visa_status) => {
        const result = candidateEnrollmentSchema.safeParse({ ...validBase, visa_status });
        expect(result.success).toBe(true);
      });
    });

    it('accepts all valid pay_type values', () => {
      (['w2', 'c2c', '1099'] as const).forEach((pay_type) => {
        const result = candidateEnrollmentSchema.safeParse({ ...validBase, pay_type });
        expect(result.success).toBe(true);
      });
    });

    it('accepts all valid gender values', () => {
      (['male', 'female', 'other', 'prefer_not_to_say'] as const).forEach((gender) => {
        const result = candidateEnrollmentSchema.safeParse({ ...validBase, gender });
        expect(result.success).toBe(true);
      });
    });

    it('coerces years_experience from string to number', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        years_experience: '3',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.years_experience).toBe(3);
      }
    });

    it('coerces expected_rate from string to number', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        expected_rate: '75',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expected_rate).toBe(75);
      }
    });

    it('accepts linkedin_url as empty string', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        linkedin_url: '',
      });
      expect(result.success).toBe(true);
    });

    it('accepts linkedin_email as empty string', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        linkedin_email: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('full_name validation', () => {
    it('rejects a name shorter than 2 characters', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, full_name: 'A' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('full_name');
        expect(result.error.issues[0].message).toMatch(/required/i);
      }
    });

    it('rejects an empty full_name', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, full_name: '' });
      expect(result.success).toBe(false);
    });

    it('accepts a name with exactly 2 characters', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, full_name: 'Jo' });
      expect(result.success).toBe(true);
    });
  });

  describe('email validation', () => {
    it('rejects an invalid email', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, email: 'not-an-email' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('rejects an email without a domain', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, email: 'user@' });
      expect(result.success).toBe(false);
    });

    it('accepts a valid email with subdomain', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        email: 'user@mail.example.co',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('phone validation', () => {
    it('rejects a phone number shorter than 7 characters', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, phone: '12345' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('phone');
      }
    });

    it('accepts a phone number with exactly 7 characters', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, phone: '1234567' });
      expect(result.success).toBe(true);
    });

    it('accepts a longer phone number', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, phone: '+15551234567' });
      expect(result.success).toBe(true);
    });
  });

  describe('technology validation', () => {
    it('rejects empty technology string', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, technology: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('technology');
      }
    });

    it('accepts a single character technology', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, technology: 'C' });
      expect(result.success).toBe(true);
    });
  });

  describe('ssn_last4 validation', () => {
    it('rejects a 3-character ssn_last4', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, ssn_last4: '123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('ssn_last4');
      }
    });

    it('rejects a 5-character ssn_last4', () => {
      const result = candidateEnrollmentSchema.safeParse({ ...validBase, ssn_last4: '12345' });
      expect(result.success).toBe(false);
    });
  });

  describe('visa_status validation', () => {
    it('rejects an invalid visa_status value', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        visa_status: 'f1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pay_type validation', () => {
    it('rejects an invalid pay_type', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        pay_type: 'hourly',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('linkedin_url validation', () => {
    it('rejects an invalid URL for linkedin_url', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        linkedin_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('linkedin_url');
      }
    });

    it('accepts a valid HTTPS URL', () => {
      const result = candidateEnrollmentSchema.safeParse({
        ...validBase,
        linkedin_url: 'https://www.linkedin.com/in/janedoe',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('rejects when full_name is missing', () => {
      const { full_name: _, ...rest } = validBase;
      const result = candidateEnrollmentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects when email is missing', () => {
      const { email: _, ...rest } = validBase;
      const result = candidateEnrollmentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects when phone is missing', () => {
      const { phone: _, ...rest } = validBase;
      const result = candidateEnrollmentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects when technology is missing', () => {
      const { technology: _, ...rest } = validBase;
      const result = candidateEnrollmentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});
