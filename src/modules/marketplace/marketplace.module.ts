import { Module } from '@nestjs/common';
import { CatalogueModule } from './catalogue/catalogue.module';
import { ListingsModule } from './listings/listings.module';
import { MatchesModule } from './matches/matches.module';

/**
 * Marketplace Module - Discovery Domain
 *
 * Aggregates all marketplace-related functionality:
 * - Catalogue: Service categorization
 * - Listings: Provider equipment listings
 * - Matches: Wave-based matching engine
 */
@Module({
    imports: [
        CatalogueModule,
        ListingsModule,
        MatchesModule,
    ],
    exports: [
        CatalogueModule,
        ListingsModule,
        MatchesModule,
    ],
})
export class MarketplaceModule {}
