import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expiryLabel, status } from './status.js';

test('calcula el estado usando el último día del mes de vencimiento', () => {
  const date = '2026-09-09';
  assert.equal(status({ card_status: 'unknown' }, date), 'Sin confirmar');
  assert.equal(status({ card_status: 'no_card' }, date), 'No tiene');
  assert.equal(status({ card_status: 'has_card' }, date), 'Revisar');
  assert.equal(status({ card_status: 'has_card', card_expiry_month: '2026-08-01' }, date), 'Vencido');
  assert.equal(status({ card_status: 'has_card', card_expiry_month: '2026-09-01' }, date), 'Próximo a vencer');
  assert.equal(status({ card_status: 'has_card', card_expiry_month: '2026-10-01' }, date), 'Vigente');
  assert.equal(expiryLabel('2027-04-01'), '04/2027');
});
