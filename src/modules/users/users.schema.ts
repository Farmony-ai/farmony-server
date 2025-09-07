import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ type: String, default: 'provider', enum: ['provider', 'seeker'] })
  defaultLandingPage: string;

  @Prop({ type: String, default: 'active' })
  defaultProviderTab: string; // 'active', 'completed', 'review'

  @Prop({ type: String })
  preferredLanguage: string;

  @Prop({ type: Boolean, default: true })
  notificationsEnabled: boolean;
}

const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: false })
  email?: string;

  

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, required: true })
  phone: string;

  // Optional gender field to capture user's gender in plain words
  @Prop({ type: String, enum: ['male','female','other','prefer_not_to_say'], required: false })
  gender?: string;

  // Optional date of birth field; stored as a Date
  @Prop({ type: Date, required: false })
  dateOfBirth?: Date;

  @Prop({ type: String, required: true, enum: ['individual','SHG','FPO','admin'] })
  role: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: 'none', enum: ['none','pending','approved','rejected'] })
  kycStatus: string;

  @Prop({ type: UserPreferencesSchema, default: () => ({}) })
  preferences: UserPreferences;

  @Prop({ type: Types.ObjectId, ref: 'Address' })
  defaultAddressId: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Hash password before saving
UserSchema.pre<UserDocument>('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
  next();
});