import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../modules/identity/schemas/users.schema';
import * as admin from 'firebase-admin';

/**
 * Seed Admin User Script
 *
 * This script creates an admin user in MongoDB and Firebase.
 *
 * Usage:
 * 1. First create the user in Firebase Authentication (email/password)
 * 2. Run: npm run seed:admin -- --email=admin@farmony.com --phone=+919876543210 --name="Admin User"
 * 3. Or clear and recreate: npm run seed:admin -- --email=admin@farmony.com --phone=+919876543210 --name="Admin User" --clear
 */

async function seedAdmin() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        // Get the User model
        const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

        console.log('🌱 Starting admin user seeding...\n');

        // Parse command line arguments
        const args = process.argv.slice(2);
        const getArg = (name: string): string | null => {
            const arg = args.find((a) => a.startsWith(`--${name}=`));
            return arg ? arg.split('=')[1] : null;
        };

        const email = getArg('email') || 'admin@farmony.com';
        const phone = getArg('phone') || '+919876543210';
        const name = getArg('name') || 'Admin User';
        const shouldClear = args.includes('--clear');

        console.log('📧 Admin Email:', email);
        console.log('📱 Admin Phone:', phone);
        console.log('👤 Admin Name:', name);
        console.log('');

        // Check if admin user already exists by phone
        const existingUser = await userModel.findOne({ phone });

        if (existingUser && !shouldClear) {
            console.log('⚠️  Admin user already exists with this phone number!');
            console.log('User details:');
            console.log('  - ID:', existingUser._id.toString());
            console.log('  - Name:', existingUser.name);
            console.log('  - Email:', existingUser.email);
            console.log('  - Phone:', existingUser.phone);
            console.log('  - Role:', existingUser.role);
            console.log('  - Verified:', existingUser.isVerified);
            console.log('\nUse --clear flag to delete and recreate the admin user.');
            return;
        }

        if (existingUser && shouldClear) {
            console.log('🗑️  Clearing existing admin user...');
            await userModel.deleteOne({ _id: existingUser._id });
            console.log('✅ Existing user deleted\n');
        }

        // Create admin user in MongoDB
        console.log('📝 Creating admin user in MongoDB...');
        const adminUser = new userModel({
            name,
            email,
            phone,
            role: 'admin',
            isVerified: true,
            kycStatus: 'approved',
            preferences: {
                defaultLandingPage: 'seeker',
                defaultProviderTab: 'listings',
                notificationsEnabled: true,
            },
            addresses: [],
            serviceCategories: [],
        });

        const savedUser = await adminUser.save();
        console.log('✅ Admin user created in MongoDB');
        console.log('  - ID:', savedUser._id.toString());
        console.log('  - Name:', savedUser.name);
        console.log('  - Email:', savedUser.email);
        console.log('  - Phone:', savedUser.phone);
        console.log('  - Role:', savedUser.role);
        console.log('');

        // Verify Firebase Admin is initialized
        console.log('🔥 Checking Firebase Authentication...');

        try {
            // Try to get or create the user in Firebase
            let firebaseUser;
            try {
                firebaseUser = await admin.auth().getUserByEmail(email);
                console.log('✅ Firebase user already exists');
                console.log('  - UID:', firebaseUser.uid);
                console.log('  - Email:', firebaseUser.email);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    console.log('⚠️  Firebase user not found.');
                    console.log('\n📝 Please create the Firebase user manually:');
                    console.log('   1. Go to Firebase Console > Authentication');
                    console.log('   2. Add a new user with email/password:');
                    console.log(`      - Email: ${email}`);
                    console.log('      - Password: [Your secure password]');
                    console.log('   3. Note down the UID');
                    console.log('\n💡 Or run this command to create the user:');
                    console.log(`   firebase auth:create ${email} --password [YOUR_PASSWORD] --display-name "${name}"`);
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error('❌ Firebase check failed:', error.message);
            console.log('\n⚠️  MongoDB user created but Firebase setup incomplete.');
            console.log('   Please ensure Firebase Authentication is properly configured.');
        }

        console.log('\n✅ Admin seeding completed!');
        console.log('\n📋 Next steps:');
        console.log('   1. Ensure the user exists in Firebase Authentication');
        console.log('   2. Use these credentials to login to the admin panel');
        console.log(`   3. Email: ${email}`);
        console.log('   4. Password: [The password you set in Firebase]');
    } catch (error: any) {
        console.error('❌ Seeding failed:', error.message);
        console.error(error);
    } finally {
        await app.close();
    }
}

// Run the seeding function
seedAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
