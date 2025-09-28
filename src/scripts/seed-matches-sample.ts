import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../modules/users/users.schema';
import { Catalogue, CatalogueDocument } from '../modules/catalogue/catalogue.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const catalogueModel = app.get<Model<CatalogueDocument>>(getModelToken(Catalogue.name));

    const sampleCategory = await catalogueModel.findOne({}).lean();
    if (!sampleCategory) {
      console.error('No catalogue entries found. Seed catalogue first.');
      return process.exit(1);
    }

    console.log('Using category:', sampleCategory._id.toString());

    const updateRes = await userModel.updateMany(
      {
        isVerified: true,
        kycStatus: 'approved',
        coordinates: { $exists: true },
      },
      {
        $set: {
          serviceRadius: 10000,
          serviceCategories: [new Types.ObjectId(sampleCategory._id)],
          qualityScore: 0,
        },
      },
    );
    console.log(`Updated ${updateRes.modifiedCount ?? updateRes.nModified ?? 0} existing providers.`);

    if (process.argv.includes('--create-samples')) {
      const ensureUser = async (phone: string, data: Partial<User>) => {
        const existing = await userModel.findOne({ phone });
        if (existing) return existing;
        const u = new userModel({
          name: data.name || 'Sample Provider',
          email: data.email || undefined,
          phone,
          password: data['password'] || 'Password123!',
          role: data['role'] || 'individual',
          isVerified: true,
          kycStatus: 'approved',
          coordinates: data['coordinates'] as any,
          serviceRadius: data['serviceRadius'] as any,
          serviceCategories: [new Types.ObjectId(sampleCategory._id)],
          qualityScore: data['qualityScore'] ?? 0,
          preferences: {
            defaultLandingPage: 'provider',
            defaultProviderTab: 'active',
            notificationsEnabled: true,
          },
        } as any);
        await u.save();
        return u;
      };

      await ensureUser('+15550000001', {
        name: 'North Farm Services',
        email: 'north@farm.com',
        coordinates: [-96.797, 32.7767] as any,
        serviceRadius: 8000,
        qualityScore: 4.5,
      });

      await ensureUser('+15550000002', {
        name: 'East Agricultural Co',
        email: 'east@farm.com',
        coordinates: [-96.687, 32.7767] as any,
        serviceRadius: 5000,
        qualityScore: 4.2,
        role: 'SHG' as any,
      });
      console.log('Created sample providers (if missing).');
    }

    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();

