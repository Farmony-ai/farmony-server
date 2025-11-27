import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';

async function removeCatalogues() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the model without importing the schema types
    const catalogueModel: any = app.get(getModelToken('Catalogue'));
    
    console.log('🗑️  Starting catalogue removal...\n');
    
    // Categories to remove
    const categoriesToRemove = [
      'Storage & Transport',
      'Event Equipment',
      'Farm Produce',
      'Dairy Products',
      'Processed Foods',
      'Handicrafts',
      'Organic Products',
      'Specialized Services'
    ];
    
    let totalRemoved = 0;
    let subcategoriesRemoved = 0;
    
    for (const categoryName of categoriesToRemove) {
      try {
        // Find the parent category
        const parentCategory = await catalogueModel.findOne({ 
          name: categoryName,
          parentId: null 
        });
        
        if (!parentCategory) {
          console.log(`⚠️  Category not found: ${categoryName}`);
          continue;
        }
        
        // First, remove all subcategories of this parent
        const subcategoryResult = await catalogueModel.deleteMany({ 
          parentId: parentCategory._id 
        });
        
        subcategoriesRemoved += subcategoryResult.deletedCount || 0;
        
        if (subcategoryResult.deletedCount > 0) {
          console.log(`  📄 Removed ${subcategoryResult.deletedCount} subcategories from ${categoryName}`);
        }
        
        // Then remove the parent category itself
        const parentResult = await catalogueModel.deleteOne({ 
          _id: parentCategory._id 
        });
        
        if (parentResult.deletedCount > 0) {
          console.log(`✅ Removed category: ${categoryName}`);
          totalRemoved++;
        }
        
      } catch (error: any) {
        console.error(`❌ Error removing category ${categoryName}:`, error.message);
      }
    }
    
    console.log('\n📊 Removal Summary:');
    console.log(`   Parent categories removed: ${totalRemoved}`);
    console.log(`   Subcategories removed: ${subcategoriesRemoved}`);
    console.log(`   Total items removed: ${totalRemoved + subcategoriesRemoved}`);
    
    // Optional: Show remaining categories
    if (process.argv.includes('--show-remaining')) {
      console.log('\n📋 Remaining categories in database:');
      const remaining = await catalogueModel.find({ parentId: null }).select('name');
      remaining.forEach((cat: any, index: number) => {
        console.log(`   ${index + 1}. ${cat.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Removal failed:', error);
  } finally {
    await app.close();
  }
}

// Run the removal script
removeCatalogues()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

// Usage:
// npx ts-node src/scripts/remove-catalogues.ts
// npx ts-node src/scripts/remove-catalogues.ts --show-remaining