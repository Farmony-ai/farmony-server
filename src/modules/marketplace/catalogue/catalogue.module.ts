import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Catalogue, CatalogueSchema } from './schemas/catalogue.schema';
import { CatalogueService } from './services/catalogue.service';
import { CatalogueController } from './controllers/catalogue.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Catalogue.name, schema: CatalogueSchema }
        ])
    ],
    providers: [CatalogueService],
    controllers: [CatalogueController],
    exports: [CatalogueService],
})
export class CatalogueModule {}
