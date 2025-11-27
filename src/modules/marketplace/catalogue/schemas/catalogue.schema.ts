import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CatalogueDocument = Catalogue & Document;

export enum ResourceCategory {
    MACHINES_EQUIPMENT = 'machines_equipment',
    MANPOWER = 'manpower',
    FARM_INPUTS = 'farm_inputs',
    MATERIALS = 'materials',
    MATERIALS_TOOLS = 'materials_tools',
    SERVICES = 'services',
    PRODUCTS_PRODUCE = 'products_produce'
}

export enum TransactionType {
    RENTAL = 'rental',
    PURCHASE = 'purchase',
    SERVICE = 'service',
    HIRING = 'hiring',
    SALE = 'sale'
}

export enum UnitOfMeasure {
    PER_HOUR = 'per_hour',
    PER_DAY = 'per_day',
    PER_WEEK = 'per_week',
    PER_MONTH = 'per_month',
    PER_ACRE = 'per_acre',
    PER_UNIT = 'per_unit',
    PER_KG = 'per_kg',
    PER_QUINTAL = 'per_quintal',
    PER_PIECE = 'per_piece'
}

@Schema({ timestamps: true })
export class Catalogue {
    @Prop({ type: String, required: true })
    name: string;

    @Prop({ type: String })
    description?: string;

    @Prop({ type: String, enum: Object.values(ResourceCategory), required: true })
    category: ResourceCategory;

    @Prop({ type: String, enum: Object.values(TransactionType), required: true })
    transactionType: TransactionType;

    @Prop({ type: Types.ObjectId, ref: 'Catalogue', default: null })
    parentId: Types.ObjectId | null;

    @Prop({ type: String })
    icon?: string;

    @Prop({ type: String, enum: Object.values(UnitOfMeasure) })
    defaultUnitOfMeasure?: UnitOfMeasure;

    @Prop({ type: Number })
    suggestedMinPrice?: number;

    @Prop({ type: Number })
    suggestedMaxPrice?: number;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;

    @Prop({ type: Number, default: 0 })
    sortOrder: number;

    @Prop({ type: [String], default: [] })
    tags?: string[];

    @Prop({ type: Map, of: String })
    metadata?: Map<string, string>;

    // Docs-aligned fields
    @Prop({ type: [String], default: [] })
    categoryPath?: string[];

    @Prop({ type: String })
    fullPath?: string;
}

export const CatalogueSchema = SchemaFactory.createForClass(Catalogue);

// Indexes
CatalogueSchema.index({ name: 1, parentId: 1 }, { unique: true });
CatalogueSchema.index({ category: 1, isActive: 1 });
CatalogueSchema.index({ parentId: 1, sortOrder: 1 });
CatalogueSchema.index({ categoryPath: 1 });
