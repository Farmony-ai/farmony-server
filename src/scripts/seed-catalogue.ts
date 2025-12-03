import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Catalogue, CatalogueDocument, ResourceCategory, TransactionType, UnitOfMeasure } from '../modules/marketplace/catalogue/schemas/catalogue.schema';

async function seedCatalogue() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the model using the correct token
    const catalogueModel = app.get<Model<CatalogueDocument>>(getModelToken(Catalogue.name));
    
    console.log('🌱 Starting catalogue seeding...\n');
    
    let totalCreated = 0;
    let totalSkipped = 0;

    // Optionally clear existing data
    if (process.argv.includes('--clear')) {
      await catalogueModel.deleteMany({});
      console.log('🗑️  Cleared existing catalogue data\n');
    }

    for (const category of catalogueData) {
      try {
        // Check if category already exists
        const existing = await catalogueModel.findOne({ 
          name: category.name,
          parentId: null 
        });

        if (existing) {
          console.log(`⚠️  Skipped category ${category.name}: Already exists`);
          totalSkipped++;
          
          // Still try to create subcategories
          if (category.subcategories) {
            const results = await createSubcategories(catalogueModel, existing, category.subcategories);
            totalCreated += results.created;
            totalSkipped += results.skipped;
          }
          continue;
        }

        // Create parent category
        console.log(`📁 Creating category: ${category.name}`);
        const parentDoc = new catalogueModel({
          name: category.name,
          description: category.description,
          category: category.category,
          transactionType: category.transactionType,
          icon: category.icon,
          isActive: true,
          sortOrder: totalCreated * 10,
          parentId: null
        });
        
        const savedParent = await parentDoc.save();
        totalCreated++;

        // Create subcategories
        if (category.subcategories) {
          const results = await createSubcategories(catalogueModel, savedParent, category.subcategories);
          totalCreated += results.created;
          totalSkipped += results.skipped;
        }
      } catch (error: any) {
        console.error(`❌ Error creating category ${category.name}:`, error.message);
        totalSkipped++;
      }
    }

    console.log('\n✅ Catalogue seeding completed!');
    console.log(`📊 Total created: ${totalCreated}`);
    console.log(`⏭️  Total skipped: ${totalSkipped}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await app.close();
  }
}

async function createSubcategories(
  catalogueModel: Model<CatalogueDocument>,
  parent: CatalogueDocument, 
  subcategories: any[]
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < subcategories.length; i++) {
    const subcat = subcategories[i];
    try {
      // Check if subcategory already exists
      const existing = await catalogueModel.findOne({ 
        name: subcat.name,
        parentId: parent._id 
      });

      if (existing) {
        console.log(`  ⚠️  Skipped subcategory ${subcat.name}: Already exists`);
        skipped++;
        continue;
      }

      console.log(`  📄 Creating subcategory: ${subcat.name}`);
      const subcatDoc = new catalogueModel({
        name: subcat.name,
        description: subcat.description,
        category: subcat.category || parent.category,
        transactionType: subcat.transactionType || parent.transactionType,
        parentId: parent._id,
        icon: subcat.icon,
        defaultUnitOfMeasure: subcat.defaultUnitOfMeasure,
        suggestedMinPrice: subcat.suggestedMinPrice,
        suggestedMaxPrice: subcat.suggestedMaxPrice,
        isActive: true,
        sortOrder: i * 10
      });
      
      await subcatDoc.save();
      created++;
    } catch (error: any) {
      console.error(`  ❌ Error creating subcategory ${subcat.name}:`, error.message);
      skipped++;
    }
  }

  return { created, skipped };
}

// Catalogue data
const catalogueData = [
  {
    name: 'Agricultural Machinery',
    description: 'Heavy machinery and equipment for farming operations',
    category: ResourceCategory.MACHINES_EQUIPMENT,
    transactionType: TransactionType.RENTAL,
    icon: 'tractor',
    subcategories: [
      {
        name: 'Tractors',
        description: 'Various types of tractors for farming',
        icon: 'tractor',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 500,
        suggestedMaxPrice: 1500
      },
      {
        name: 'Ploughs',
        description: 'Traditional and modern ploughing equipment',
        icon: 'plough',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 300,
        suggestedMaxPrice: 800
      },
      {
        name: 'Harvesters',
        description: 'Crop harvesting machines',
        icon: 'harvester',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 1000,
        suggestedMaxPrice: 2500
      },
      {
        name: 'Seed Drills',
        description: 'Machines for sowing seeds',
        icon: 'seed-drill',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 400,
        suggestedMaxPrice: 1000
      },
      {
        name: 'Rotavators',
        description: 'Soil preparation equipment',
        icon: 'rotavator',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 400,
        suggestedMaxPrice: 900
      },
      {
        name: 'Sprayers',
        description: 'Pesticide and fertilizer spraying equipment',
        icon: 'sprayer',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 300,
        suggestedMaxPrice: 600
      }
    ]
  },
  {
    name: 'Irrigation Equipment',
    description: 'Water management and irrigation systems',
    category: ResourceCategory.MACHINES_EQUIPMENT,
    transactionType: TransactionType.RENTAL,
    icon: 'water-pump',
    subcategories: [
      {
        name: 'Water Pumps',
        description: 'Electric and diesel water pumps',
        icon: 'pump',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 200,
        suggestedMaxPrice: 500
      },
      {
        name: 'Drip Irrigation Sets',
        description: 'Complete drip irrigation systems',
        icon: 'drip',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 150,
        suggestedMaxPrice: 400
      },
      {
        name: 'Sprinkler Systems',
        description: 'Overhead irrigation sprinklers',
        icon: 'sprinkler',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 200,
        suggestedMaxPrice: 450
      },
      {
        name: 'Bore Well Machines',
        description: 'Equipment for bore well drilling',
        icon: 'drill',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 5000,
        suggestedMaxPrice: 10000
      }
    ]
  },
  {
    name: 'Processing Machinery',
    description: 'Post-harvest processing equipment',
    category: ResourceCategory.MACHINES_EQUIPMENT,
    transactionType: TransactionType.RENTAL,
    icon: 'processor',
    subcategories: [
      {
        name: 'Threshers',
        description: 'Grain threshing machines',
        icon: 'thresher',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 300,
        suggestedMaxPrice: 700
      },
      {
        name: 'Rice Mills',
        description: 'Rice processing equipment',
        icon: 'mill',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 500,
        suggestedMaxPrice: 1200
      },
      {
        name: 'Oil Expellers',
        description: 'Oil extraction machines',
        icon: 'oil-press',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 400,
        suggestedMaxPrice: 1000
      },
      {
        name: 'Flour Mills',
        description: 'Grain grinding equipment',
        icon: 'flour-mill',
        defaultUnitOfMeasure: UnitOfMeasure.PER_HOUR,
        suggestedMinPrice: 200,
        suggestedMaxPrice: 500
      }
    ]
  },
  {
    name: 'Drone Services',
    description: 'Drone services',
    category: ResourceCategory.MATERIALS_TOOLS,
    transactionType: TransactionType.HIRING,
    icon: 'drone',
    subcategories: [
      {
        name: 'Pesticide Drones',
        description: 'Pesticide spraying using drones',
        icon: 'pesticide-drone',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 1000,
        suggestedMaxPrice: 2000
      },
      {
        name: 'Seed Drones',
        description: 'Seed spreading using drones',
        icon: 'seed-drone',
        defaultUnitOfMeasure: UnitOfMeasure.PER_ACRE,
        suggestedMinPrice: 3000,
        suggestedMaxPrice: 4000
      }
    ]
  },
  {
    name: 'Agricultural Labor',
    description: 'Skilled and unskilled farm workers',
    category: ResourceCategory.MANPOWER,
    transactionType: TransactionType.HIRING,
    icon: 'farmer',
    subcategories: [
      {
        name: 'Field Workers',
        description: 'General farm labor for various tasks',
        icon: 'worker',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 300,
        suggestedMaxPrice: 500
      },
      {
        name: 'Harvest Workers',
        description: 'Specialized workers for crop harvesting',
        icon: 'harvester-worker',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 350,
        suggestedMaxPrice: 600
      },
      {
        name: 'Pesticide Sprayers',
        description: 'Trained workers for chemical application',
        icon: 'sprayer-worker',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 400,
        suggestedMaxPrice: 700
      },
      {
        name: 'Irrigation Workers',
        description: 'Workers for irrigation management',
        icon: 'water-worker',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 350,
        suggestedMaxPrice: 550
      },
      {
        name: 'Pruning Experts',
        description: 'Skilled workers for tree/plant pruning',
        icon: 'pruner',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 500,
        suggestedMaxPrice: 800
      }
    ]
  },
  {
    name: 'Construction Workers',
    description: 'Skilled construction and masonry workers',
    category: ResourceCategory.MANPOWER,
    transactionType: TransactionType.HIRING,
    icon: 'construction',
    subcategories: [
      {
        name: 'Masons',
        description: 'Brick and concrete work specialists',
        icon: 'mason',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 600,
        suggestedMaxPrice: 1000
      },
      {
        name: 'Carpenters',
        description: 'Wood work and furniture makers',
        icon: 'carpenter',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 500,
        suggestedMaxPrice: 900
      },
      {
        name: 'Electricians',
        description: 'Electrical installation and repair',
        icon: 'electrician',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 600,
        suggestedMaxPrice: 1200
      },
      {
        name: 'Plumbers',
        description: 'Water and sanitation work',
        icon: 'plumber',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 500,
        suggestedMaxPrice: 1000
      },
      {
        name: 'Painters',
        description: 'Building painting and finishing',
        icon: 'painter',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 400,
        suggestedMaxPrice: 700
      },
      {
        name: 'Welders',
        description: 'Metal fabrication and welding',
        icon: 'welder',
        defaultUnitOfMeasure: UnitOfMeasure.PER_DAY,
        suggestedMinPrice: 600,
        suggestedMaxPrice: 1100
      }
    ]
  },
  
];

// Run the seeder
seedCatalogue()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

// Usage:
// npx ts-node src/scripts/seed-catalogue.ts
// npx ts-node src/scripts/seed-catalogue.ts --clear