import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { getDatabase, closeDatabase, getSqlite, migrate } from '@dds/database';
import { randomUUID } from 'node:crypto';

// The database module needs special handling for tests
// This tests the REST API endpoints with supertest

describe('REST API', () => {
  beforeAll(async () => {
    await getDatabase({ path: ':memory:' });
    migrate();

    // Seed test data
    const db = getSqlite();
    const now = new Date().toISOString();
    const deviceId = randomUUID();

    db.run(
      `INSERT INTO devices (id, manufacturer, model, device_type, date_added, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [deviceId, 'TestCorp', 'TestModel 3000', 'laptop', now, now, now],
    );

    db.run(
      `INSERT INTO diagnostic_sessions (id, device_id, session_code, payload, health_score, overall_status, started_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), deviceId, 'TEST01', '{}', 85, 'good', now, now],
    );
  });

  afterAll(() => {
    closeDatabase();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/v1/devices returns device list', async () => {
    const res = await request(app).get('/api/v1/devices');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/devices returns pagination metadata', async () => {
    const res = await request(app).get('/api/v1/devices?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(10);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('GET /api/v1/sessions returns session list', async () => {
    const res = await request(app).get('/api/v1/sessions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/search returns results for matching query', async () => {
    const res = await request(app).get('/api/v1/search?q=TestCorp');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/devices creates a new device', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({
        manufacturer: 'NewBrand',
        model: 'NewModel Pro',
        deviceType: 'desktop',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.manufacturer).toBe('NewBrand');
    expect(res.body.data.company_sku).toBeDefined();
  });

  it('POST /api/v1/devices validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({ manufacturer: 'Test' }); // missing model
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/devices/stats returns device statistics', async () => {
    const res = await request(app).get('/api/v1/devices/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data.todayCount).toBeDefined();
  });

  it('DELETE /api/v1/devices/:id deletes a device', async () => {
    // Create device to delete
    const createRes = await request(app)
      .post('/api/v1/devices')
      .send({ manufacturer: 'DeleteMe', model: 'ToDelete', deviceType: 'other' });
    const id = createRes.body.data.id;

    const delRes = await request(app).delete(`/api/v1/devices/${id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);
  });

  it('returns 404 for non-existent device', async () => {
    const res = await request(app).get('/api/v1/devices/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
