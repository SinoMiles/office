import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhone } from '../lib/phone.js';
import { tc3Authorization } from '../lib/tencent-signature.js';

test('normalizePhone folds the ways a number gets pasted in', () => {
  // 同一个号码有好几种写法，不收敛的话唯一索引形同虚设。
  for (const input of ['13812345678', '138 1234 5678', '138-1234-5678', '+8613812345678', '8613812345678']) {
    assert.equal(normalizePhone(input), '13812345678', input);
  }
});

test('normalizePhone rejects anything that is not a mainland mobile', () => {
  for (const input of ['', null, undefined, '12812345678', '1381234567', '138123456789', '02112345678', 'abcdefghijk', '+1 415 555 0100']) {
    assert.equal(normalizePhone(input), '', String(input));
  }
});

test('tc3Authorization signs the documented header set', () => {
  const header = tc3Authorization({
    secretId: 'AKIDEXAMPLE', secretKey: 'SECRETEXAMPLE',
    host: 'sms.tencentcloudapi.com', service: 'sms', action: 'SendSms',
    payload: '{"a":1}', timestamp: 1700000000,
  });
  // 回归锁：签名一旦被无意改动，这里立刻红。腾讯云签错只会回一个
  // 含糊的 AuthFailure.SignatureFailure，靠线上报错很难定位。
  assert.equal(
    header,
    'TC3-HMAC-SHA256 Credential=AKIDEXAMPLE/2023-11-14/sms/tc3_request, '
    + 'SignedHeaders=content-type;host;x-tc-action, '
    + 'Signature=f9dce45024079cb4c24dd34270c809b5b0ccec4586453765ebbea07b6cd7412a',
  );
});

test('tc3Authorization takes the credential date from UTC, not local time', () => {
  // 1700000000 = 2023-11-14T22:13:20Z。东八区当地已是 15 号，
  // 用本地日期算 scope 会让签名在每天早八点前后成片失败。
  assert.match(tc3Authorization({
    secretId: 'AKIDEXAMPLE', secretKey: 'SECRETEXAMPLE',
    host: 'sms.tencentcloudapi.com', service: 'sms', action: 'SendSms',
    payload: '{}', timestamp: 1700000000,
  }), /Credential=AKIDEXAMPLE\/2023-11-14\/sms\/tc3_request/);
});

test('tc3Authorization actually binds the payload and the action', () => {
  const base = { secretId: 'AKIDEXAMPLE', secretKey: 'SECRETEXAMPLE', host: 'sms.tencentcloudapi.com', service: 'sms', action: 'SendSms', payload: '{"a":1}', timestamp: 1700000000 };
  const signature = (overrides) => tc3Authorization({ ...base, ...overrides }).split('Signature=')[1];
  assert.notEqual(signature({}), signature({ payload: '{"a":2}' }));
  assert.notEqual(signature({}), signature({ action: 'PullSmsSendStatus' }));
  assert.notEqual(signature({}), signature({ secretKey: 'OTHER' }));
  assert.equal(signature({}), signature({}));
});
