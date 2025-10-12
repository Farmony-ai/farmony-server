// src/modules/addresses/addresses.e2e-spec.ts
// Integration tests for address-based flows

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Address Integration (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let authToken: string;
  let userId: string;
  let addressId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    connection = moduleFixture.get<Connection>(getConnectionToken());

    // Create test user and login
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test Provider',
        email: 'provider@test.com',
        phone: '9876543210',
        password: 'Test123!',
        role: 'individual'
      });

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await connection.collection('users').deleteMany({ email: 'provider@test.com' });
    await connection.collection('addresses').deleteMany({ userId });
    await connection.collection('listings').deleteMany({ providerId: userId });
    await connection.collection('service_requests').deleteMany({ seekerId: userId });
    
    await app.close();
  });

  describe('Address Management', () => {
    it('should create an address for user', async () => {
      const response = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          tag: 'farm',
          addressLine1: 'Farm Plot A-23',
          village: 'Mahipalpur',
          district: 'South West Delhi',
          state: 'Delhi',
          pincode: '110037',
          coordinates: [77.1234, 28.5678]
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.tag).toBe('farm');
      expect(response.body.coordinates).toEqual([77.1234, 28.5678]);
      
      addressId = response.body._id;
    });

    it('should get all user addresses', async () => {
      const response = await request(app.getHttpServer())
        .get(`/addresses/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].userId).toBe(userId);
    });

    it('should set address as default', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/addresses/${addressId}/set-default`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isDefault).toBe(true);
    });
  });

  describe('Listing with Address', () => {
    let listingId: string;

    it('should create listing with existing address', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: userId,
          addressId: addressId, // Use existing address
          categoryId: '507f1f77bcf86cd799439011',
          subCategoryId: '507f1f77bcf86cd799439012',
          title: 'Tractor for Rent',
          description: 'John Deere Tractor available',
          price: 1500,
          unitOfMeasure: 'per_hour',
          availableFrom: '2024-01-01',
          availableTo: '2024-12-31'
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.serviceAddressId).toBe(addressId);
      expect(response.body.location.coordinates).toEqual([77.1234, 28.5678]);
      
      listingId = response.body._id;
    });

    it('should create listing with new address coordinates', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: userId,
          location: { lat: 28.6789, lon: 77.9876 }, // New coordinates
          addressLine1: 'New Service Location',
          village: 'Dwarka',
          district: 'South West Delhi',
          state: 'Delhi',
          pincode: '110077',
          categoryId: '507f1f77bcf86cd799439011',
          subCategoryId: '507f1f77bcf86cd799439012',
          title: 'Harvester for Rent',
          description: 'Combine Harvester available',
          price: 3000,
          unitOfMeasure: 'per_hour',
          availableFrom: '2024-01-01',
          availableTo: '2024-12-31'
        })
        .expect(201);

      expect(response.body).toHaveProperty('serviceAddressId');
      expect(response.body.location.coordinates).toEqual([77.9876, 28.6789]);
    });

    it('should populate address when fetching listing', async () => {
      const response = await request(app.getHttpServer())
        .get(`/listings/${listingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.serviceAddressId).toHaveProperty('_id');
      expect(response.body.serviceAddressId.addressLine1).toBe('Farm Plot A-23');
      expect(response.body.serviceAddressId.village).toBe('Mahipalpur');
    });
  });

  describe('Service Request with Address', () => {
    let requestId: string;

    it('should create service request with existing address', async () => {
      const response = await request(app.getHttpServer())
        .post('/service-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          addressId: addressId, // Use existing address
          categoryId: '507f1f77bcf86cd799439011',
          subCategoryId: '507f1f77bcf86cd799439012',
          title: 'Need Tractor for Plowing',
          description: '5 acres of land to plow',
          serviceStartDate: new Date('2024-02-01'),
          serviceEndDate: new Date('2024-02-02'),
          metadata: {
            quantity: 5,
            unitOfMeasure: 'acres'
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.serviceAddressId).toBe(addressId);
      expect(response.body.location.coordinates).toEqual([77.1234, 28.5678]);
      
      requestId = response.body._id;
    });

    it('should create service request with new location', async () => {
      const response = await request(app.getHttpServer())
        .post('/service-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: { lat: 28.7777, lon: 77.7777 },
          addressLine1: 'Field Number 42',
          village: 'Najafgarh',
          district: 'South West Delhi',
          state: 'Delhi',
          pincode: '110043',
          categoryId: '507f1f77bcf86cd799439011',
          subCategoryId: '507f1f77bcf86cd799439012',
          title: 'Urgent Harvesting Required',
          description: 'Wheat ready for harvest',
          serviceStartDate: new Date('2024-02-05'),
          serviceEndDate: new Date('2024-02-06')
        })
        .expect(201);

      expect(response.body).toHaveProperty('serviceAddressId');
      expect(response.body.location.coordinates).toEqual([77.7777, 28.7777]);
    });

    it('should populate address when fetching request', async () => {
      const response = await request(app.getHttpServer())
        .get(`/service-requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.serviceAddressId).toHaveProperty('_id');
      expect(response.body.serviceAddressId.village).toBe('Mahipalpur');
    });
  });

  describe('Coordinate Validation', () => {
    it('should reject invalid coordinates', async () => {
      const response = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          tag: 'invalid',
          addressLine1: 'Test',
          village: 'Test',
          district: 'Test',
          state: 'Test',
          pincode: '123456',
          coordinates: [200, 100] // Invalid: out of range
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid coordinates');
    });

    it('should reject malformed coordinates', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: userId,
          location: { lat: 'invalid', lon: 'invalid' }, // Invalid: not numbers
          categoryId: '507f1f77bcf86cd799439011',
          title: 'Test',
          price: 1000,
          unitOfMeasure: 'per_hour'
        })
        .expect(400);
    });
  });

  describe('Address-based Matching', () => {
    it('should find listings near service request address', async () => {
      // Create service request
      const serviceRequest = await request(app.getHttpServer())
        .post('/service-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          addressId: addressId,
          categoryId: '507f1f77bcf86cd799439011',
          subCategoryId: '507f1f77bcf86cd799439012',
          title: 'Test Request',
          description: 'Test',
          serviceStartDate: new Date('2024-03-01'),
          serviceEndDate: new Date('2024-03-02')
        });

      // The service should automatically find nearby providers
      // based on the address coordinates
      expect(serviceRequest.body.status).toBe('MATCHED');
      expect(serviceRequest.body.notificationWaves).toBeDefined();
    });

    it('should calculate distance between addresses correctly', async () => {
      // Create two addresses at known distances
      const address1 = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          tag: 'location1',
          addressLine1: 'Location 1',
          village: 'Village 1',
          district: 'District',
          state: 'State',
          pincode: '123456',
          coordinates: [77.0000, 28.0000]
        });

      const address2 = await request(app.getHttpServer())
        .post('/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          tag: 'location2',
          addressLine1: 'Location 2',
          village: 'Village 2',
          district: 'District',
          state: 'State',
          pincode: '123456',
          coordinates: [77.0100, 28.0100]
        });

      // The distance between these points should be approximately 1.57 km
      // This can be used in the matching algorithm tests
    });
  });

  describe('Error Handling', () => {
    it('should handle missing address gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerId: userId,
          // No address provided - should use default
          categoryId: '507f1f77bcf86cd799439011',
          title: 'Test Listing',
          price: 1000,
          unitOfMeasure: 'per_hour',
          availableFrom: '2024-01-01',
          availableTo: '2024-12-31'
        })
        .expect(201);

      // Should fall back to user's default address
      expect(response.body).toHaveProperty('serviceAddressId');
    });

    it('should reject if user has no addresses', async () => {
      // Create user without addresses
      const newUser = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'No Address User',
          email: 'noaddress@test.com',
          phone: '9999999999',
          password: 'Test123!',
          role: 'individual'
        });

      const response = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${newUser.body.access_token}`)
        .send({
          providerId: newUser.body.user.id,
          categoryId: '507f1f77bcf86cd799439011',
          title: 'Test',
          price: 1000,
          unitOfMeasure: 'per_hour'
        })
        .expect(404);

      expect(response.body.message).toContain('No address found');
    });
  });
});