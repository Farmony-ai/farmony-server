import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/users.schema';

@Injectable()
export class FcmTokenService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

    async registerToken(userId: string, token: string): Promise<UserDocument> {
        if (!token) {
            throw new BadRequestException('FCM token is required');
        }

        const user = await this.userModel
            .findByIdAndUpdate(userId, { $addToSet: { fcmTokens: token } }, { new: true })
            .exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }
        return user;
    }

    async removeToken(userId: string, token: string): Promise<UserDocument> {
        if (!token) {
            throw new BadRequestException('FCM token is required');
        }

        const user = await this.userModel
            .findByIdAndUpdate(userId, { $pull: { fcmTokens: token } }, { new: true })
            .exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }
        return user;
    }

    async getTokens(userId: string): Promise<string[]> {
        const user = await this.userModel.findById(userId).select('fcmTokens').lean().exec();

        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }
        return user.fcmTokens || [];
    }

    async getTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
        const users = await this.userModel
            .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id fcmTokens')
            .lean()
            .exec();

        const tokenMap = new Map<string, string[]>();
        for (const user of users) {
            tokenMap.set(user._id.toString(), user.fcmTokens || []);
        }
        return tokenMap;
    }

    /**
     * Remove multiple invalid tokens from users
     * Called after FCM send failures to clean up stale tokens
     */
    async removeInvalidTokens(tokens: string[]): Promise<void> {
        if (!tokens || tokens.length === 0) return;

        try {
            // Remove tokens from all users who have them
            const result = await this.userModel
                .updateMany({ fcmTokens: { $in: tokens } }, { $pull: { fcmTokens: { $in: tokens } } })
                .exec();

            if (result.modifiedCount > 0) {
                console.log(`Removed ${tokens.length} invalid FCM tokens from ${result.modifiedCount} users`);
            }
        } catch (error) {
            console.error('Failed to remove invalid FCM tokens:', error);
        }
    }
}
