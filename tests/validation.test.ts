import assert from 'node:assert/strict';
import { test } from 'node:test';
import { developmentDatabaseUrl } from '../src/config.js';
import { decisionFields, fileFields, professorFields } from '../src/data/validation.js';

const fields = { displayName: ' Alex ', degree: '', department: '', education: '', about: '', researchAreas: [], contactEmail: null, virtualOfficeUrl: null, officeHours: '' };
test('profile input trims names and rejects owner mass-assignment, invalid links, duplicate areas', () => {
  assert.equal(professorFields.parse(fields).displayName, 'Alex');
  for (const invalid of [ { ...fields, userId: 'spoofed' }, { ...fields, displayName: '  ' },
    { ...fields, virtualOfficeUrl: 'javascript:alert(1)' }, { ...fields, contactEmail: 'not-an-email' },
    { ...fields, researchAreas: ['AI', 'ai'] }, { ...fields, about: 'x'.repeat(5001) } ]) {
    assert.equal(professorFields.safeParse(invalid).success, false);
  }
});
test('decisions require a decline reason and reject one for acceptance', () => {
  assert.equal(decisionFields.safeParse({ status: 'DECLINED', denialReason: ' ' }).success, false);
  assert.equal(decisionFields.safeParse({ status: 'ACCEPTED', denialReason: 'no' }).success, false);
  assert.equal(decisionFields.safeParse({ status: 'DECLINED', denialReason: 'Missing prerequisite' }).success, true);
});
test('file metadata rejects empty, oversized, unexpected media, public URLs and traversal', () => {
  const photo = { storageKey: 'dev/avatar.png', originalName: 'avatar.png', mediaType: 'image/png', sizeBytes: 100, purpose: 'PHOTO' };
  assert.equal(fileFields.safeParse(photo).success, true);
  for (const invalid of [{ ...photo, sizeBytes: 0 }, { ...photo, sizeBytes: 2097153 },
    { ...photo, mediaType: 'text/html' }, { ...photo, storageKey: 'https://public.test/file' }, { ...photo, storageKey: 'a/../file' }]) {
    assert.equal(fileFields.safeParse(invalid).success, false);
  }
});
test('development tools reject remote, non-development, host overrides and non-test targets', () => {
  for (const url of [undefined, 'invalid', 'postgresql://u:p@db.example.test/campus_dev',
    'postgresql://u:p@127.0.0.1/production', 'postgresql://u:p@127.0.0.1/campus_dev?host=remote']) {
    assert.throws(() => developmentDatabaseUrl(url));
  }
  assert.throws(() => developmentDatabaseUrl('postgresql://u:p@127.0.0.1/campus_dev', true));
  assert.equal(developmentDatabaseUrl('postgresql://u:p@localhost/campus_test', true), 'postgresql://u:p@localhost/campus_test');
});
test('development connection is blocked when NODE_ENV is production', () => {
  const prior = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(() => developmentDatabaseUrl('postgresql://u:p@localhost/campus_dev'), /cannot run in production/);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});
