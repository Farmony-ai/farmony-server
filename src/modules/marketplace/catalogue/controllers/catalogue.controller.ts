import { Controller, Get, Post, Param, Query, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { CatalogueService, CatalogueFilters, CatalogueSearchQuery } from '../services/catalogue.service';
import { ResourceCategory, TransactionType } from '../schemas/catalogue.schema';

@ApiTags('Catalogue')
@Controller('catalogue')
export class CatalogueController {
    constructor(private readonly catalogueService: CatalogueService) {}

    /**
     * GET /api/catalogue/categories
     * List all root categories or filter by criteria
     */
    @Get('categories')
    @ApiOperation({
        summary: 'List categories',
        description: 'Get all categories with optional filters. By default returns only root categories (no parent).'
    })
    @ApiQuery({ name: 'category', enum: ResourceCategory, required: false, description: 'Filter by resource category' })
    @ApiQuery({ name: 'transactionType', enum: TransactionType, required: false, description: 'Filter by transaction type' })
    @ApiQuery({ name: 'isActive', type: Boolean, required: false, description: 'Filter by active status (default: true)' })
    @ApiQuery({ name: 'parentId', type: String, required: false, description: 'Filter by parent category ID (null for roots)' })
    async getAllCategories(
        @Query('category') category?: ResourceCategory,
        @Query('transactionType') transactionType?: TransactionType,
        @Query('isActive') isActive?: string,
        @Query('parentId') parentId?: string
    ) {
        const filters: CatalogueFilters = {};

        if (category) {
            filters.category = category;
        }

        if (transactionType) {
            filters.transactionType = transactionType;
        }

        if (isActive !== undefined) {
            filters.isActive = isActive === 'true';
        }

        if (parentId !== undefined) {
            filters.parentId = parentId === 'null' ? null : parentId;
        }

        const categories = await this.catalogueService.getAllCategories(filters);

        return {
            message: 'Categories retrieved successfully',
            count: categories.length,
            categories
        };
    }

    /**
     * GET /api/catalogue/categories/:id
     * Get detailed information about a specific category
     */
    @Get('categories/:id')
    @ApiOperation({
        summary: 'Get category details',
        description: 'Get full details of a category by ID, including parent information'
    })
    @ApiParam({ name: 'id', description: 'Category ID' })
    async getCategoryById(@Param('id') id: string) {
        const category = await this.catalogueService.getCategoryById(id);

        return {
            message: 'Category retrieved successfully',
            category
        };
    }

    /**
     * GET /api/catalogue/categories/:id/children
     * Get all direct children (subcategories) of a category
     */
    @Get('categories/:id/children')
    @ApiOperation({
        summary: 'Get subcategories',
        description: 'Get all direct child categories of a parent category'
    })
    @ApiParam({ name: 'id', description: 'Parent category ID' })
    async getSubcategories(@Param('id') id: string) {
        const subcategories = await this.catalogueService.getSubcategories(id);

        return {
            message: 'Subcategories retrieved successfully',
            parentId: id,
            count: subcategories.length,
            subcategories
        };
    }

    /**
     * GET /api/catalogue/categories/:id/tree
     * Get full hierarchical tree starting from a category
     */
    @Get('categories/:id/tree')
    @ApiOperation({
        summary: 'Get category tree',
        description: 'Get full hierarchical tree structure starting from a category (includes all descendants)'
    })
    @ApiParam({ name: 'id', description: 'Root category ID (use "all" for full tree)' })
    async getCategoryTree(@Param('id') id: string) {
        const tree = await this.catalogueService.getCategoryTree(id === 'all' ? undefined : id);

        return {
            message: 'Category tree retrieved successfully',
            rootId: id === 'all' ? null : id,
            tree
        };
    }

    /**
     * GET /api/catalogue/categories/by-path
     * Get category by hierarchical path (e.g., "machines_equipment/tractors")
     */
    @Get('categories/by-path')
    @ApiOperation({
        summary: 'Get category by path',
        description: 'Find a category by its hierarchical path (e.g., "machines_equipment/tractors")'
    })
    @ApiQuery({ name: 'path', type: String, required: true, description: 'Hierarchical path separated by /' })
    async getCategoryByPath(@Query('path') path: string) {
        if (!path) {
            throw new BadRequestException('Path query parameter is required');
        }

        const category = await this.catalogueService.getCategoryByPath(path);

        return {
            message: 'Category retrieved successfully',
            path,
            category
        };
    }

    /**
     * POST /api/catalogue/search
     * Search categories by name, description, or tags
     */
    @Post('search')
    @ApiOperation({
        summary: 'Search categories',
        description: 'Search categories by query string (matches name, description, tags)'
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['query'],
            properties: {
                query: { type: 'string', description: 'Search query string' },
                category: { type: 'string', enum: Object.values(ResourceCategory), description: 'Filter by resource category' },
                transactionType: { type: 'string', enum: Object.values(TransactionType), description: 'Filter by transaction type' }
            }
        }
    })
    async searchCategories(@Body() searchQuery: CatalogueSearchQuery) {
        const results = await this.catalogueService.searchCategories(searchQuery);

        return {
            message: 'Search completed successfully',
            query: searchQuery.query,
            count: results.length,
            results
        };
    }

    /**
     * GET /api/catalogue/categories/:id/items
     * Get count of items (listings) in a category
     */
    @Get('categories/:id/items')
    @ApiOperation({
        summary: 'Get items in category',
        description: 'Get count of listings in a specific category'
    })
    @ApiParam({ name: 'id', description: 'Category ID' })
    async getItemsInCategory(@Param('id') id: string) {
        const result = await this.catalogueService.getItemsInCategory(id);

        return {
            message: 'Category item count retrieved successfully',
            ...result
        };
    }

    /**
     * GET /api/catalogue/resource-categories/:category
     * Get all categories of a specific resource category
     */
    @Get('resource-categories/:category')
    @ApiOperation({
        summary: 'Get categories by resource category',
        description: 'Get all categories belonging to a specific resource category (e.g., all MACHINES_EQUIPMENT)'
    })
    @ApiParam({ name: 'category', enum: ResourceCategory, description: 'Resource category' })
    async getCategoriesByResourceCategory(@Param('category') category: ResourceCategory) {
        const categories = await this.catalogueService.getCategoriesByResourceCategory(category);

        return {
            message: 'Categories retrieved successfully',
            resourceCategory: category,
            count: categories.length,
            categories
        };
    }

    /**
     * GET /api/catalogue/transaction-types/:type
     * Get all categories by transaction type
     */
    @Get('transaction-types/:type')
    @ApiOperation({
        summary: 'Get categories by transaction type',
        description: 'Get all categories for a specific transaction type (e.g., all RENTAL categories)'
    })
    @ApiParam({ name: 'type', enum: TransactionType, description: 'Transaction type' })
    async getCategoriesByTransactionType(@Param('type') type: TransactionType) {
        const categories = await this.catalogueService.getCategoriesByTransactionType(type);

        return {
            message: 'Categories retrieved successfully',
            transactionType: type,
            count: categories.length,
            categories
        };
    }

    /**
     * GET /api/catalogue/validate/:id
     * Validate that a category exists and is active
     */
    @Get('validate/:id')
    @ApiOperation({
        summary: 'Validate category',
        description: 'Check if a category ID is valid and active'
    })
    @ApiParam({ name: 'id', description: 'Category ID to validate' })
    async validateCategory(@Param('id') id: string) {
        const isValid = await this.catalogueService.validateCategory(id);

        return {
            categoryId: id,
            isValid,
            message: isValid ? 'Category is valid' : 'Category is invalid or inactive'
        };
    }
}
