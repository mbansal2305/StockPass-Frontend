import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { apiClient } from './client';
import { masterApi } from './master';

test('master list sends search separately from filters and preserves pagination metadata', async t => {
  const post = t.mock.method(apiClient, 'post', async () => ({
    data: { page: 2, page_size: 100, total: 101, total_pages: 2, results: [{ id: 101 }] }
  }));

  const result = await masterApi.listPaginated('businessclient', { type: 'COMPANY' }, 2, 100, '  wheat  ');

  assert.deepEqual(post.mock.calls[0].arguments, ['/master/lst/', {
    entity: 'businessclient',
    filters: { type: 'company' },
    page: 2,
    page_size: 100,
    search: 'wheat'
  }]);
  assert.deepEqual(result, { results: [{ id: 101 }], total: 101, page: 2, pageSize: 100, totalPages: 2 });
});

test('master list does not send an empty search', async t => {
  const post = t.mock.method(apiClient, 'post', async () => ({
    data: { page: 1, page_size: 50, total: 0, total_pages: 1, results: [] }
  }));

  await masterApi.listPaginated('commodity', {}, 1, 50, '  ');

  assert.equal(JSON.stringify(post.mock.calls[0].arguments[1]), JSON.stringify({
    entity: 'commodity', filters: {}, page: 1, page_size: 50
  }));
});
