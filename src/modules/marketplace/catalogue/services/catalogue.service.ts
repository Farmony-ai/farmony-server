import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Catalogue, CatalogueDocument, ResourceCategory, TransactionType } from '../schemas/catalogue.schema';

export interface CatalogueFilters {
    category?: ResourceCategory;
    transactionType?: TransactionType;
    isActive?: boolean;
    parentId?: string | null;
}

export interface CatalogueSearchQuery {
    query: string;
    category?: ResourceCategory;
    transactionType?: TransactionType;
}

@Injectable()
export class CatalogueService {
    private readonly logger = new Logger(CatalogueService.name);

    constructor(
        @InjectModel(Catalogue.name)
        private readonly catalogueModel: Model<CatalogueDocument>
    ) {}

    /**
     * Get all categories with optional filters
     * By default returns only root categories (parentId: null)
     */
    async getAllCategories(filters?: CatalogueFilters): Promise<Catalogue[]> {
        const query: any = {
            isActive: filters?.isActive !== undefined ? filters.isActive : true
        };

        // If no parentId specified, default to root categories
        if (filters?.parentId === undefined) {
            query.parentId = null;
        } else if (filters.parentId !== null) {
            query.parentId = new Types.ObjectId(filters.parentId);
        }

        if (filters?.category) {
            query.category = filters.category;
        }

        if (filters?.transactionType) {
            query.transactionType = filters.transactionType;
        }

        const categories = await this.catalogueModel
            .find(query)
            .sort({ sortOrder: 1, name: 1 })
            .lean()
            .exec();

        this.logger.log(`Found ${categories.length} categories with filters: ${JSON.stringify(filters)}`);
        return categories as any;
    }

    /**
     * Get category by ID with full details
     */
    async getCategoryById(categoryId: string): Promise<Catalogue> {
        if (!Types.ObjectId.isValid(categoryId)) {
            throw new BadRequestException('Invalid category ID format');
        }

        const category = await this.catalogueModel
            .findById(categoryId)
            .populate('parentId', 'name category icon')
            .lean()
            .exec();

        if (!category) {
            throw new NotFoundException(`Category with ID ${categoryId} not found`);
        }

        return category as any;
    }

    /**
     * Get all subcategories for a parent category
     */
    async getSubcategories(parentId: string): Promise<Catalogue[]> {
        if (!Types.ObjectId.isValid(parentId)) {
            throw new BadRequestException('Invalid parent category ID format');
        }

        // Verify parent exists
        const parent = await this.catalogueModel.findById(parentId);
        if (!parent) {
            throw new NotFoundException(`Parent category with ID ${parentId} not found`);
        }

        const subcategories = await this.catalogueModel
            .find({
                parentId: new Types.ObjectId(parentId),
                isActive: true
            })
            .sort({ sortOrder: 1, name: 1 })
            .lean()
            .exec();

        this.logger.log(`Found ${subcategories.length} subcategories for parent ${parentId}`);
        return subcategories as any;
    }

    /**
     * Get full category tree starting from a category (or all roots if no ID)
     * Returns hierarchical structure with children populated
     */
    async getCategoryTree(rootCategoryId?: string): Promise<any[]> {
        let rootCategories: Catalogue[];

        if (rootCategoryId) {
            // Get specific category as root
            const root = await this.getCategoryById(rootCategoryId);
            rootCategories = [root];
        } else {
            // Get all root categories
            rootCategories = await this.getAllCategories({ parentId: null });
        }

        // Recursively build tree
        const buildTree = async (categories: Catalogue[]): Promise<any[]> => {
            return Promise.all(
                categories.map(async (category) => {
                    const children = await this.catalogueModel
                        .find({
                            parentId: (category as any)._id,
                            isActive: true
                        })
                        .sort({ sortOrder: 1, name: 1 })
                        .lean()
                        .exec();

                    const categoryWithChildren = {
                        ...category,
                        children: children.length > 0 ? await buildTree(children as any) : []
                    };

                    return categoryWithChildren;
                })
            );
        };

        const tree = await buildTree(rootCategories);
        this.logger.log(`Built category tree with ${tree.length} root nodes`);
        return tree;
    }

    /**
     * Get category by hierarchical path (e.g., "machines_equipment/tractors")
     */
    async getCategoryByPath(path: string): Promise<Catalogue> {
        if (!path || typeof path !== 'string') {
            throw new BadRequestException('Invalid path format');
        }

        const pathSegments = path.split('/').filter(Boolean);
        if (pathSegments.length === 0) {
            throw new BadRequestException('Path cannot be empty');
        }

        let currentCategory: Catalogue | null = null;
        let currentParentId: Types.ObjectId | null = null;

        // Traverse path segments
        for (const segment of pathSegments) {
            const category = await this.catalogueModel
                .findOne({
                    name: segment,
                    parentId: currentParentId,
                    isActive: true
                })
                .lean()
                .exec();

            if (!category) {
                throw new NotFoundException(`Category not found at path segment: ${segment}`);
            }

            currentCategory = category as any;
            currentParentId = (category as any)._id;
        }

        if (!currentCategory) {
            throw new NotFoundException(`Category not found at path: ${path}`);
        }

        this.logger.log(`Found category by path ${path}: ${currentCategory.name}`);
        return currentCategory;
    }

    /**
     * Search categories by name, description, or tags
     */
    async searchCategories(searchQuery: CatalogueSearchQuery): Promise<Catalogue[]> {
        if (!searchQuery.query || searchQuery.query.trim().length === 0) {
            throw new BadRequestException('Search query cannot be empty');
        }

        const query: any = {
            isActive: true,
            $or: [
                { name: { $regex: searchQuery.query, $options: 'i' } },
                { description: { $regex: searchQuery.query, $options: 'i' } },
                { tags: { $in: [new RegExp(searchQuery.query, 'i')] } }
            ]
        };

        if (searchQuery.category) {
            query.category = searchQuery.category;
        }

        if (searchQuery.transactionType) {
            query.transactionType = searchQuery.transactionType;
        }

        const results = await this.catalogueModel
            .find(query)
            .populate('parentId', 'name category icon')
            .sort({ sortOrder: 1, name: 1 })
            .limit(50)
            .lean()
            .exec();

        this.logger.log(`Search for "${searchQuery.query}" returned ${results.length} results`);
        return results as any;
    }

    /**
     * Validate that a category ID exists and is active
     * Used by other services (e.g., listings, service requests)
     */
    async validateCategory(categoryId: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(categoryId)) {
            return false;
        }

        const category = await this.catalogueModel
            .findOne({
                _id: new Types.ObjectId(categoryId),
                isActive: true
            })
            .lean()
            .exec();

        return !!category;
    }

    /**
     * Get count of items (listings) in a category
     * This would integrate with ListingsService in production
     */
    async getItemsInCategory(categoryId: string): Promise<{
        categoryId: string;
        categoryName: string;
        itemCount: number;
    }> {
        const category = await this.getCategoryById(categoryId);

        // TODO: Integrate with ListingsService to get actual count
        // For now, return placeholder
        const itemCount = 0;

        return {
            categoryId: categoryId,
            categoryName: category.name,
            itemCount
        };
    }

    /**
     * Get all categories of a specific resource category (e.g., all MACHINES_EQUIPMENT)
     */
    async getCategoriesByResourceCategory(resourceCategory: ResourceCategory): Promise<Catalogue[]> {
        const categories = await this.catalogueModel
            .find({
                category: resourceCategory,
                isActive: true
            })
            .sort({ sortOrder: 1, name: 1 })
            .lean()
            .exec();

        this.logger.log(`Found ${categories.length} categories in resource category ${resourceCategory}`);
        return categories as any;
    }

    /**
     * Get all categories by transaction type (e.g., all RENTAL categories)
     */
    async getCategoriesByTransactionType(transactionType: TransactionType): Promise<Catalogue[]> {
        const categories = await this.catalogueModel
            .find({
                transactionType: transactionType,
                isActive: true
            })
            .sort({ sortOrder: 1, name: 1 })
            .lean()
            .exec();

        this.logger.log(`Found ${categories.length} categories for transaction type ${transactionType}`);
        return categories as any;
    }
}
