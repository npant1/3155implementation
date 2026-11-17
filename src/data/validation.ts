import { z } from 'zod';

export const id = z.uuid();
const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1);
const areaList = z.array(required(100)).max(20).refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, 'Research areas must be unique.');
const optionalEmail = z.email().max(254).nullable();
const optionalHttps = z.url().max(2048).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS URL.').nullable();

export const professorFields = z.strictObject({
  displayName: required(80), degree: text(200), department: text(120),
  education: text(2000), about: text(5000), researchAreas: areaList,
  contactEmail: optionalEmail, virtualOfficeUrl: optionalHttps, officeHours: text(500),
});
export const professorUpdate = professorFields.extend({ expectedVersion: z.number().int().positive() });
export const studentFields = z.strictObject({
  displayName: required(80), major: required(100), concentration: text(100).nullable(),
  year: z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other']), about: text(1000),
});
export const fileFields = z.strictObject({
  storageKey: required(512).refine(v => !v.includes('://') && !v.split('/').includes('..'), 'Use a private object key, not a public URL.'),
  originalName: required(255), mediaType: required(100), sizeBytes: z.number().int().positive(),
  purpose: z.enum(['PHOTO', 'RESUME']),
}).superRefine((file, ctx) => {
  const allowed = file.purpose === 'PHOTO'
    ? ['image/png', 'image/jpeg', 'image/webp']
    : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const max = (file.purpose === 'PHOTO' ? 2 : 5) * 1024 * 1024;
  if (!allowed.includes(file.mediaType) || file.sizeBytes > max) ctx.addIssue({ code: 'custom', message: 'Invalid file media type or size.' });
});
export const opportunityFields = z.strictObject({
  title: required(200), description: text(20000), responsibilities: z.array(required(1000)).max(50),
  goals: z.array(required(1000)).max(50), prerequisites: z.array(required(1000)).max(50),
  duration: text(200).nullable(), hoursMin: z.number().int().min(1).max(168).nullable(),
  hoursMax: z.number().int().min(1).max(168).nullable(), deadline: z.date().nullable(),
  researchAreaIds: z.array(id).max(20),
}).refine(v => (v.hoursMin === null && v.hoursMax === null)
  || (v.hoursMin !== null && v.hoursMax !== null && v.hoursMin <= v.hoursMax), 'Specify a valid hours range.');
export const decisionFields = z.strictObject({
  status: z.enum(['ACCEPTED', 'DECLINED']), denialReason: text(2000).nullable(),
}).refine(v => v.status === 'DECLINED' ? Boolean(v.denialReason) : v.denialReason === null,
  'Declines require a reason; acceptance must not contain a denial reason.');
export const messageBody = required(5000);
